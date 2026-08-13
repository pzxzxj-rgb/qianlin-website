import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFile(path.join(projectRoot, file), "utf8");

test("defines provider independent inquiries and tenant scoped sync jobs", async () => {
  const [schema, adminInquiries, listRoute, detailRoute, syncRoute, dashboard, manager, detail, types, service, sync, factory, permissions, disabled, mock, retention, worker, safeErrors, listPage] = await Promise.all([
    read("db/schema.ts"),
    read("lib/admin/inquiries.ts"),
    read("app/api/admin/inquiries/route.ts"),
    read("app/api/admin/inquiries/[inquiryId]/route.ts"),
    read("app/api/admin/inquiries/[inquiryId]/sync/route.ts"),
    read("lib/admin/getAdminDashboard.ts"),
    read("components/AdminInquiryManager.tsx"),
    read("components/AdminInquiryDetail.tsx"),
    read("lib/integrations/erp/types.ts"),
    read("lib/inquiries/handleInquiry.ts"),
    read("lib/inquiries/syncService.ts"),
    read("lib/integrations/erp/providerFactory.ts"),
    read("lib/admin/permissions.ts"),
    read("lib/integrations/erp/disabled/DisabledErpProvider.ts"),
    read("lib/integrations/erp/mock/MockErpProvider.ts"),
    read("lib/inquiries/retention.ts"),
    read("worker/index.ts"),
    read("lib/integrations/erp/safeErrors.ts"),
    read("app/admin/inquiries/page.tsx"),
  ]);
  assert.match(schema, /tenantInquirySyncJobs = sqliteTable\("tenant_inquiry_sync_jobs"/);
  assert.match(schema, /idempotencyKey/);
  assert.match(schema, /externalRecordId/);
  assert.match(schema, /providerCheck/);
  assert.match(schema, /statusCheck/);
  assert.match(schema, /privacyConsentAt/);
  assert.match(schema, /retentionUntil/);
  assert.match(adminInquiries, /eq\(inquiries\.tenantId, tenantId\)/);
  assert.match(adminInquiries, /maskPhone/);
  assert.match(adminInquiries, /maskEmail/);
  assert.match(adminInquiries, /maskName/);
  assert.match(adminInquiries, /inquiryPiiVisibilityForRole\(role\)/);
  assert.match(listRoute, /getAdminRouteAccess/);
  assert.match(listRoute, /getAdminInquiries\(tenantId, role,/);
  assert.match(listPage, /getAdminInquiries\(access\.tenantId, access\.role,/);
  assert.match(permissions, /inquiryPiiVisibilityForRole/);
  assert.match(detailRoute, /getAdminRouteAccess/);
  assert.match(detailRoute, /getTenantId\(request, "editor", "inquiry:read_sensitive"\)/);
  assert.match(detailRoute, /inquiry:update/);
  assert.match(detailRoute, /verifySameOriginRequest/);
  assert.match(detailRoute, /getAdminInquiryDetail\(access\.tenantId, inquiryId/);
  assert.doesNotMatch(detailRoute, /export async function DELETE/);
  assert.match(manager, /contactSummary/);
  assert.match(manager, /showError && sync\.message/);
  assert.doesNotMatch(manager, /item\.phone|item\.wechat|item\.email|item\.message/);
  assert.match(detail, /inquiry\.phone/);
  assert.match(detail, /inquiry\.message/);
  assert.match(detail, /showError && sync\.message/);
  assert.match(dashboard, /tenantId/);
  assert.match(types, /Provider/);
  assert.match(types, /idempotencyKey/);
  assert.match(service, /allowedFields/);
  assert.match(service, /tenantId/);
  assert.match(service, /createInquirySyncJob/);
  assert.doesNotMatch(service, /syncInquiryJob/);
  assert.match(sync, /inquiryIdempotencyKey/);
  assert.match(sync, /eq\(tenantInquirySyncJobs\.tenantId, tenantId\)/);
  assert.match(sync, /idempotencyKey/);
  assert.match(sync, /eq\(inquiries\.tenantId, tenantId\)/);
  assert.match(sync, /processInquirySyncJob/);
  assert.match(sync, /reconcileMissingInquirySyncJobs/);
  assert.match(sync, /provider:\s*ErpProviderName/);
  // Hard fix (provider switch backfill): compensation must scope "missing" to
  // (tenant + inquiry + current provider), resolving the provider from the
  // trusted tenant context rather than the client.
  assert.match(sync, /const provider = await configuredProviderName\(tenantId\)/);
  assert.match(sync, /eq\(tenantInquirySyncJobs\.provider, provider\)/);
  assert.match(sync, /isNull\(inquiries\.anonymizedAt\)/);
  // Hard fix #1 regression (source audit): the automatic cron is queue-isolated -
  // pending jobs always take the whole budget first, retries only use leftovers,
  // and dead_letter / exhausted-failed rows are never picked up.
  assert.match(sync, /export function planDueSyncQueue\(batchLimit: number, pendingCount: number\)/);
  assert.match(sync, /const pendingBudget = Math\.min\(safePending, safeBatch\)/);
  assert.match(sync, /const retryBudget = safeBatch - pendingBudget/);
  assert.match(sync, /retryAllowed: retryBudget > 0/);
  assert.match(sync, /const plan = planDueSyncQueue\(batchLimit, pendingRows\.length\)/);
  assert.match(sync, /plan\.retryAllowed \?/);
  assert.match(sync, /limit\(plan\.retryBudget\)/);
  assert.match(sync, /lt\(tenantInquirySyncJobs\.retryCount, MAX_AUTOMATIC_RETRIES\)/);
  const queueBlock = sync.slice(sync.indexOf("const plan = planDueSyncQueue"), sync.indexOf("async function claimJob"));
  assert.ok(!queueBlock.includes("dead_letter"), "automatic-cron retry query must not select dead_letter rows");
  // Hard fix #4 regression (source audit): sync job ids and idempotency keys
  // are deterministic plain-text strings with no 32-bit hash component.
  assert.match(sync, /return `sync:\$\{tenantId\}:inquiry:\$\{inquiryId\}:provider:\$\{provider\}`/);
  assert.match(sync, /return `\$\{tenantId\}:inquiry:\$\{inquiryId\}:provider:\$\{provider\}`/);
  assert.doesNotMatch(sync, /fnv|hash32|stableHash/i);
  assert.match(syncRoute, /inquiry:sync_retry/);
  assert.match(syncRoute, /verifySameOriginRequest/);
  assert.match(syncRoute, /tenantId/);
  assert.match(permissions, /inquiry:list_masked/);
  assert.match(permissions, /inquiry:read_sensitive/);
  assert.match(permissions, /inquiry:update/);
  assert.match(permissions, /inquiry:sync_retry/);
  assert.match(schema, /tenantInquiryForeignKey/);
  assert.match(schema, /uq_inquiries_tenant_id_id/);
  assert.match(schema, /retentionPendingIndex/);
  assert.match(factory, /disabled/);
  assert.match(factory, /mock/);
  assert.match(factory, /zhilv/);
  assert.match(factory, /trustedTenantId/);
  assert.doesNotMatch(factory, /https?:\/\//);
  assert.match(disabled, /ERP_NOT_CONFIGURED/);
  assert.match(mock, /externalRecordId/);
  assert.match(safeErrors, /safeSyncErrorCode/);
  assert.match(safeErrors, /The ERP synchronization attempt failed/);
  // dead_letter shares the same safe-error conversion as failed.
  assert.match(safeErrors, /status !== "failed" && status !== "not_configured" && status !== "dead_letter"/);
  assert.match(retention, /retention_until/);
  assert.match(retention, /tenant_id = \?/);
  assert.match(retention, /anonymized_at/);
  assert.match(worker, /scheduled/);
  assert.match(worker, /anonymizeExpiredInquiries/);
});
