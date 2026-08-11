import { and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { inquiries, tenantInquirySyncJobs } from "../../db/schema";
import { assertTenantScope } from "../admin/tenantScope";
import { getErpInquiryProvider } from "../integrations/erp/providerFactory";
import { ErpProviderError, type CanonicalInquiry, type InquirySyncStatus } from "../integrations/erp/types";

function stableJobId(tenantId: string, inquiryId: number) {
  let hash = 2166136261;
  const value = `${tenantId}:inquiry:${inquiryId}`;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `sync-${(hash >>> 0).toString(36)}`;
}

export function inquiryIdempotencyKey(tenantId: string, inquiryId: number) {
  assertTenantScope(tenantId);
  if (!Number.isSafeInteger(inquiryId) || inquiryId <= 0) throw new Error("Invalid inquiry identifier");
  return `${tenantId}:inquiry:${inquiryId}`;
}

async function getJob(tenantId: string, inquiryId: number) {
  const db = await getDb();
  const [job] = await db.select().from(tenantInquirySyncJobs).where(and(eq(tenantInquirySyncJobs.tenantId, tenantId), eq(tenantInquirySyncJobs.inquiryId, inquiryId))).orderBy(tenantInquirySyncJobs.createdAt).limit(1);
  return job ?? null;
}

export async function createInquirySyncJob(tenantId: string, inquiryId: number) {
  assertTenantScope(tenantId);
  const idempotencyKey = inquiryIdempotencyKey(tenantId, inquiryId);
  const db = await getDb();
  const [inquiry] = await db.select({ id: inquiries.id })
    .from(inquiries)
    .where(and(eq(inquiries.id, inquiryId), eq(inquiries.tenantId, tenantId)))
    .limit(1);
  if (!inquiry) throw new Error("Inquiry does not belong to tenant");
  const provider = await getErpInquiryProvider();
  const existing = await getJob(tenantId, inquiryId);
  if (existing) {
    if (existing.provider !== provider.name && existing.status !== "synced") {
      await db.update(tenantInquirySyncJobs).set({ provider: provider.name, status: "pending", updatedAt: new Date().toISOString() }).where(and(eq(tenantInquirySyncJobs.id, existing.id), eq(tenantInquirySyncJobs.tenantId, tenantId), eq(tenantInquirySyncJobs.inquiryId, inquiryId)));
    }
    return (await getJob(tenantId, inquiryId)) ?? existing;
  }
  try {
    await db.insert(tenantInquirySyncJobs).values({ id: stableJobId(tenantId, inquiryId), tenantId, inquiryId, provider: provider.name, status: "pending", idempotencyKey });
  } catch {
    // A concurrent request may have created the same idempotent job.
  }
  const created = await getJob(tenantId, inquiryId);
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

async function updateJob(tenantId: string, jobId: string, values: { status: InquirySyncStatus; externalRecordId?: string | null; lastErrorCode?: string | null; lastErrorMessage?: string | null; lastAttemptAt?: string; syncedAt?: string | null; retryCount?: number }) {
  const db = await getDb();
  await db.update(tenantInquirySyncJobs).set({ ...values, updatedAt: new Date().toISOString() }).where(and(eq(tenantInquirySyncJobs.id, jobId), eq(tenantInquirySyncJobs.tenantId, tenantId)));
}

export async function syncInquiryJob(tenantId: string, inquiryId: number) {
  assertTenantScope(tenantId);
  const job = await createInquirySyncJob(tenantId, inquiryId);
  if (job.status === "synced") return job;
  const provider = await getErpInquiryProvider();
  if (provider.name === "disabled" || provider.name === "zhilv") {
    await updateJob(tenantId, job.id, { status: "not_configured", lastErrorCode: "ERP_NOT_CONFIGURED", lastErrorMessage: "ERP provider is not configured." });
    return (await getJob(tenantId, inquiryId)) ?? job;
  }
  const db = await getDb();
  const [inquiry] = await db.select().from(inquiries).where(and(eq(inquiries.id, inquiryId), eq(inquiries.tenantId, tenantId))).limit(1);
  if (!inquiry) return null;
  const retryCount = job.retryCount + 1;
  await updateJob(tenantId, job.id, { status: "processing", retryCount, lastAttemptAt: new Date().toISOString(), lastErrorCode: null, lastErrorMessage: null });
  try {
    const result = await provider.createInquiry(toCanonicalInquiry(inquiry, job.idempotencyKey));
    await updateJob(tenantId, job.id, { status: "synced", externalRecordId: result.externalRecordId, syncedAt: new Date().toISOString(), lastAttemptAt: new Date().toISOString() });
  } catch (error) {
    const code = error instanceof ErpProviderError ? error.code : "ERP_PROVIDER_ERROR";
    await updateJob(tenantId, job.id, { status: "failed", lastErrorCode: code, lastErrorMessage: error instanceof ErpProviderError ? error.message : "ERP provider request failed.", lastAttemptAt: new Date().toISOString() });
  }
  return (await getJob(tenantId, inquiryId)) ?? job;
}

export async function retryInquirySyncJob(tenantId: string, jobId: string) {
  assertTenantScope(tenantId);
  const db = await getDb();
  const [job] = await db.select({ inquiryId: tenantInquirySyncJobs.inquiryId }).from(tenantInquirySyncJobs).where(and(eq(tenantInquirySyncJobs.id, jobId), eq(tenantInquirySyncJobs.tenantId, tenantId))).limit(1);
  if (!job) return null;
  return syncInquiryJob(tenantId, job.inquiryId);
}

export async function getInquirySyncJobs(tenantId: string, inquiryIds?: number[]) {
  assertTenantScope(tenantId);
  const db = await getDb();
  const rows = await db.select().from(tenantInquirySyncJobs).where(eq(tenantInquirySyncJobs.tenantId, tenantId)).orderBy(tenantInquirySyncJobs.createdAt);
  return inquiryIds ? rows.filter((row) => inquiryIds.includes(row.inquiryId)) : rows;
}
