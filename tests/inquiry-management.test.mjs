import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFile(path.join(projectRoot, file), "utf8");

test("defines provider independent inquiries and tenant scoped sync jobs", async () => {
  const [schema, adminInquiries, listRoute, detailRoute, dashboard, manager, detail, types, service, sync, factory, disabled, mock, retention, worker] = await Promise.all([
    read("db/schema.ts"),
    read("lib/admin/inquiries.ts"),
    read("app/api/admin/inquiries/route.ts"),
    read("app/api/admin/inquiries/[inquiryId]/route.ts"),
    read("lib/admin/getAdminDashboard.ts"),
    read("components/AdminInquiryManager.tsx"),
    read("components/AdminInquiryDetail.tsx"),
    read("lib/integrations/erp/types.ts"),
    read("lib/inquiries/handleInquiry.ts"),
    read("lib/inquiries/syncService.ts"),
    read("lib/integrations/erp/providerFactory.ts"),
    read("lib/integrations/erp/disabled/DisabledErpProvider.ts"),
    read("lib/integrations/erp/mock/MockErpProvider.ts"),
    read("lib/inquiries/retention.ts"),
    read("worker/index.ts"),
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
  assert.match(listRoute, /getAdminRouteAccess/);
  assert.match(detailRoute, /getAdminRouteAccess/);
  assert.match(detailRoute, /getTenantId\(request, "editor"\)/);
  assert.match(detailRoute, /verifySameOriginRequest/);
  assert.match(detailRoute, /getAdminInquiryDetail\(access\.tenantId, inquiryId\)/);
  assert.doesNotMatch(detailRoute, /export async function DELETE/);
  assert.match(manager, /contactSummary/);
  assert.doesNotMatch(manager, /item\.phone|item\.wechat|item\.email|item\.message/);
  assert.match(detail, /inquiry\.phone/);
  assert.match(detail, /inquiry\.message/);
  assert.match(dashboard, /tenantId/);
  assert.match(types, /Provider/);
  assert.match(types, /idempotencyKey/);
  assert.match(service, /allowedFields/);
  assert.match(service, /tenantId/);
  assert.match(service, /createInquirySyncJob/);
  assert.match(sync, /inquiryIdempotencyKey/);
  assert.match(sync, /eq\(tenantInquirySyncJobs\.tenantId, tenantId\)/);
  assert.match(sync, /idempotencyKey/);
  assert.match(sync, /eq\(inquiries\.tenantId, tenantId\)/);
  assert.match(schema, /tenantInquiryForeignKey/);
  assert.match(schema, /uq_inquiries_tenant_id_id/);
  assert.match(schema, /retentionPendingIndex/);
  assert.match(factory, /disabled/);
  assert.match(factory, /mock/);
  assert.match(factory, /zhilv/);
  assert.doesNotMatch(factory, /https?:\/\//);
  assert.match(disabled, /ERP_NOT_CONFIGURED/);
  assert.match(mock, /externalRecordId/);
  assert.match(retention, /retention_until/);
  assert.match(retention, /tenant_id = \?/);
  assert.match(retention, /anonymized_at/);
  assert.match(worker, /scheduled/);
  assert.match(worker, /anonymizeExpiredInquiries/);
});
