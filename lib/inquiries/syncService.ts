import { and, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { getDb } from "../../db";
import { inquiries, tenantInquirySyncJobs } from "../../db/schema";
import { assertTenantScope } from "../admin/tenantScope";
import { getErpInquiryProvider, configuredProviderName } from "../integrations/erp/providerFactory";
import { safeSyncErrorCode, safeSyncErrorMessage } from "../integrations/erp/safeErrors";
import { ErpProviderError, type CanonicalInquiry, type ErpProviderName, type InquirySyncStatus } from "../integrations/erp/types";

const MAX_AUTOMATIC_RETRIES = 5;
const PROCESSING_RECOVERY_MS = 15 * 60 * 1000;
const RETRY_BACKOFF_MS = 60 * 1000;

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function stableJobId(tenantId: string, inquiryId: number, provider: ErpProviderName) {
  return `sync-${stableHash(`${tenantId}:inquiry:${inquiryId}:provider:${provider}`)}`;
}

export function inquiryIdempotencyKey(tenantId: string, inquiryId: number, provider: ErpProviderName = "disabled") {
  assertTenantScope(tenantId);
  if (!Number.isSafeInteger(inquiryId) || inquiryId <= 0) throw new Error("Invalid inquiry identifier");
  return `${tenantId}:inquiry:${inquiryId}:provider:${provider}`;
}

function safeErrorCode(error: unknown) {
  const candidate = error instanceof ErpProviderError ? error.code : "ERP_PROVIDER_ERROR";
  return safeSyncErrorCode(candidate);
}

function isStaleProcessing(value: string | null, now = Date.now()) {
  if (!value) return true;
  const timestamp = Date.parse(value);
  return !Number.isFinite(timestamp) || timestamp <= now - PROCESSING_RECOVERY_MS;
}

function isRetryDue(row: { status: string; retryCount: number; lastAttemptAt: string | null; updatedAt: string }, now = Date.now()) {
  if (row.status === "pending") return true;
  if (row.status === "processing") return isStaleProcessing(row.lastAttemptAt ?? row.updatedAt, now);
  if (row.status !== "failed" || row.retryCount >= MAX_AUTOMATIC_RETRIES) return false;
  const lastAttempt = Date.parse(row.lastAttemptAt ?? row.updatedAt);
  return !Number.isFinite(lastAttempt) || lastAttempt <= now - RETRY_BACKOFF_MS;
}

async function getJob(tenantId: string, inquiryId: number, provider: ErpProviderName) {
  const db = await getDb();
  const [job] = await db.select().from(tenantInquirySyncJobs).where(and(
    eq(tenantInquirySyncJobs.tenantId, tenantId),
    eq(tenantInquirySyncJobs.inquiryId, inquiryId),
    eq(tenantInquirySyncJobs.provider, provider),
  )).orderBy(desc(tenantInquirySyncJobs.createdAt)).limit(1);
  return job ?? null;
}

export async function getCurrentInquirySyncJob(tenantId: string, inquiryId: number) {
  assertTenantScope(tenantId);
  const provider = await configuredProviderName(tenantId);
  return getJob(tenantId, inquiryId, provider);
}

export async function createInquirySyncJob(tenantId: string, inquiryId: number) {
  assertTenantScope(tenantId);
  const db = await getDb();
  const [inquiry] = await db.select({ id: inquiries.id })
    .from(inquiries)
    .where(and(eq(inquiries.id, inquiryId), eq(inquiries.tenantId, tenantId)))
    .limit(1);
  if (!inquiry) throw new Error("Inquiry does not belong to tenant");

  const provider = await getErpInquiryProvider(tenantId);
  const existing = await getJob(tenantId, inquiryId, provider.name);
  if (existing) return existing;

  const notConfigured = provider.name === "disabled" || provider.name === "zhilv";
  const status: InquirySyncStatus = notConfigured ? "not_configured" : "pending";
  const errorCode = notConfigured ? "ERP_NOT_CONFIGURED" : null;
  try {
    await db.insert(tenantInquirySyncJobs).values({
      id: stableJobId(tenantId, inquiryId, provider.name),
      tenantId,
      inquiryId,
      provider: provider.name,
      status,
      idempotencyKey: inquiryIdempotencyKey(tenantId, inquiryId, provider.name),
      lastErrorCode: errorCode,
      lastErrorMessage: errorCode ? safeSyncErrorMessage(errorCode) : null,
    });
  } catch (error) {
    const concurrent = await getJob(tenantId, inquiryId, provider.name);
    if (concurrent) return concurrent;
    throw error;
  }
  const created = await getJob(tenantId, inquiryId, provider.name);
  if (!created) throw new Error("Inquiry sync job could not be created");
  return created;
}

function toCanonicalInquiry(row: typeof inquiries.$inferSelect, idempotencyKey: string): CanonicalInquiry {
  return {
    inquiryId: row.id,
    idempotencyKey,
    tenantId: row.tenantId,
    name: row.name,
    phone: row.phone,
    wechat: row.wechat,
    email: row.email,
    location: row.location,
    travelDate: row.travelDate,
    travelers: row.travelers,
    duration: row.duration,
    tourName: row.tourName,
    places: row.places,
    message: row.message,
  };
}

type JobUpdate = {
  status: InquirySyncStatus;
  externalRecordId?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  lastAttemptAt?: string | null;
  syncedAt?: string | null;
  retryCount?: number;
};

async function updateJob(tenantId: string, jobId: string, inquiryId: number, values: JobUpdate) {
  const db = await getDb();
  const rows = await db.update(tenantInquirySyncJobs)
    .set({ ...values, updatedAt: new Date().toISOString() })
    .where(and(
      eq(tenantInquirySyncJobs.id, jobId),
      eq(tenantInquirySyncJobs.tenantId, tenantId),
      eq(tenantInquirySyncJobs.inquiryId, inquiryId),
    ))
    .returning({ id: tenantInquirySyncJobs.id });
  return Boolean(rows[0]);
}

async function claimJob(tenantId: string, job: typeof tenantInquirySyncJobs.$inferSelect, forceRetry = false) {
  const now = Date.now();
  const due = forceRetry || isRetryDue(job, now);
  if (!due || job.status === "synced" || job.status === "not_configured") return false;
  const staleProcessing = job.status === "processing" && isStaleProcessing(job.lastAttemptAt ?? job.updatedAt, now);
  const db = await getDb();
  const eligible = forceRetry
    ? or(eq(tenantInquirySyncJobs.status, "pending"), eq(tenantInquirySyncJobs.status, "failed"), and(eq(tenantInquirySyncJobs.status, "processing"), lt(tenantInquirySyncJobs.updatedAt, new Date(now - PROCESSING_RECOVERY_MS).toISOString())))
    : or(eq(tenantInquirySyncJobs.status, "pending"), and(eq(tenantInquirySyncJobs.status, "failed"), lt(tenantInquirySyncJobs.updatedAt, new Date(now - RETRY_BACKOFF_MS).toISOString())), and(eq(tenantInquirySyncJobs.status, "processing"), lt(tenantInquirySyncJobs.updatedAt, new Date(now - PROCESSING_RECOVERY_MS).toISOString())));
  const rows = await db.update(tenantInquirySyncJobs)
    .set({ status: "processing", retryCount: job.retryCount + (staleProcessing ? 0 : 1), lastAttemptAt: new Date().toISOString(), lastErrorCode: null, lastErrorMessage: null, updatedAt: new Date().toISOString() })
    .where(and(eq(tenantInquirySyncJobs.id, job.id), eq(tenantInquirySyncJobs.tenantId, tenantId), eq(tenantInquirySyncJobs.inquiryId, job.inquiryId), eligible))
    .returning({ id: tenantInquirySyncJobs.id });
  return Boolean(rows[0]);
}

export async function processInquirySyncJob(tenantId: string, jobId: string, inquiryId: number, options: { forceRetry?: boolean } = {}) {
  assertTenantScope(tenantId);
  const db = await getDb();
  const [job] = await db.select().from(tenantInquirySyncJobs).where(and(
    eq(tenantInquirySyncJobs.id, jobId),
    eq(tenantInquirySyncJobs.tenantId, tenantId),
    eq(tenantInquirySyncJobs.inquiryId, inquiryId),
  )).limit(1);
  if (!job) return null;

  const provider = await getErpInquiryProvider(tenantId);
  if (job.provider !== provider.name || job.status === "synced") return job;
  if (provider.name === "disabled" || provider.name === "zhilv") {
    if (job.status !== "not_configured") {
      await updateJob(tenantId, job.id, job.inquiryId, { status: "not_configured", lastErrorCode: "ERP_NOT_CONFIGURED", lastErrorMessage: safeSyncErrorMessage("ERP_NOT_CONFIGURED"), lastAttemptAt: new Date().toISOString() });
      return (await getJob(tenantId, inquiryId, job.provider)) ?? job;
    }
    return job;
  }
  if (!(await claimJob(tenantId, job, options.forceRetry))) return (await getJob(tenantId, inquiryId, job.provider)) ?? job;

  const [inquiry] = await db.select().from(inquiries).where(and(eq(inquiries.id, inquiryId), eq(inquiries.tenantId, tenantId))).limit(1);
  if (!inquiry) {
    await updateJob(tenantId, jobId, inquiryId, { status: "failed", lastErrorCode: "INQUIRY_NOT_FOUND", lastErrorMessage: safeSyncErrorMessage("INQUIRY_NOT_FOUND"), lastAttemptAt: new Date().toISOString() });
    return (await getJob(tenantId, inquiryId, job.provider)) ?? job;
  }

  try {
    const result = await provider.createInquiry(toCanonicalInquiry(inquiry, job.idempotencyKey));
    await updateJob(tenantId, jobId, inquiryId, { status: "synced", externalRecordId: result.externalRecordId, syncedAt: new Date().toISOString(), lastAttemptAt: new Date().toISOString() });
  } catch (error) {
    const code = safeErrorCode(error);
    await updateJob(tenantId, jobId, inquiryId, { status: "failed", lastErrorCode: code, lastErrorMessage: safeSyncErrorMessage(code), lastAttemptAt: new Date().toISOString() });
  }
  return (await getJob(tenantId, inquiryId, job.provider)) ?? job;
}

export async function retryInquirySyncJob(tenantId: string, jobId: string) {
  assertTenantScope(tenantId);
  const db = await getDb();
  const provider = await configuredProviderName(tenantId);
  const [job] = await db.select().from(tenantInquirySyncJobs).where(and(
    eq(tenantInquirySyncJobs.id, jobId),
    eq(tenantInquirySyncJobs.tenantId, tenantId),
  )).limit(1);
  if (!job) return null;
  if (job.provider !== provider || job.status === "synced") return job;
  return processInquirySyncJob(tenantId, job.id, job.inquiryId, { forceRetry: true });
}

export async function retryCurrentInquirySyncJob(tenantId: string, inquiryId: number) {
  assertTenantScope(tenantId);
  const current = await getCurrentInquirySyncJob(tenantId, inquiryId);
  const job = current ?? await createInquirySyncJob(tenantId, inquiryId);
  if (job.status === "synced") return job;
  return processInquirySyncJob(tenantId, job.id, job.inquiryId, { forceRetry: true });
}

export async function compensateMissingInquirySyncJobs(tenantId: string, limit = 100) {
  assertTenantScope(tenantId);
  const db = await getDb();
  const rows = await db.select({ id: inquiries.id })
    .from(inquiries)
    .leftJoin(tenantInquirySyncJobs, and(eq(tenantInquirySyncJobs.tenantId, inquiries.tenantId), eq(tenantInquirySyncJobs.inquiryId, inquiries.id)))
    .where(and(eq(inquiries.tenantId, tenantId), isNull(tenantInquirySyncJobs.id), isNull(inquiries.anonymizedAt)))
    .orderBy(inquiries.createdAt)
    .limit(Math.min(Math.max(limit, 1), 500));
  let created = 0;
  for (const row of rows) {
    try {
      await createInquirySyncJob(tenantId, row.id);
      created += 1;
    } catch (error) {
      console.error("Failed to compensate inquiry sync job", error instanceof Error ? error.name : "UnknownError");
    }
  }
  return created;
}

export async function reconcileMissingInquirySyncJobs(limitPerTenant = 100) {
  const db = await getDb();
  const rows = await db.select({ tenantId: inquiries.tenantId }).from(inquiries).where(isNull(inquiries.anonymizedAt)).groupBy(inquiries.tenantId);
  let created = 0;
  for (const row of rows) created += await compensateMissingInquirySyncJobs(row.tenantId, limitPerTenant);
  return created;
}

export async function processDueInquirySyncJobs(limit = 100) {
  const db = await getDb();
  const now = Date.now();
  const cutoff = new Date(now - RETRY_BACKOFF_MS).toISOString();
  const staleCutoff = new Date(now - PROCESSING_RECOVERY_MS).toISOString();
  const rows = await db.select().from(tenantInquirySyncJobs).where(or(
    eq(tenantInquirySyncJobs.status, "pending"),
    and(eq(tenantInquirySyncJobs.status, "failed"), lt(tenantInquirySyncJobs.updatedAt, cutoff)),
    and(eq(tenantInquirySyncJobs.status, "processing"), lt(tenantInquirySyncJobs.updatedAt, staleCutoff)),
  )).orderBy(tenantInquirySyncJobs.updatedAt).limit(Math.min(Math.max(limit, 1), 500));
  let processed = 0;
  for (const job of rows) {
    const result = await processInquirySyncJob(job.tenantId, job.id, job.inquiryId);
    if (result) processed += 1;
  }
  return processed;
}

export async function getInquirySyncJobs(tenantId: string, inquiryIds?: number[]) {
  assertTenantScope(tenantId);
  const db = await getDb();
  const conditions = [eq(tenantInquirySyncJobs.tenantId, tenantId)];
  if (inquiryIds?.length) conditions.push(inArray(tenantInquirySyncJobs.inquiryId, inquiryIds));
  return db.select().from(tenantInquirySyncJobs).where(and(...conditions)).orderBy(tenantInquirySyncJobs.createdAt);
}

export { MAX_AUTOMATIC_RETRIES, PROCESSING_RECOVERY_MS };
