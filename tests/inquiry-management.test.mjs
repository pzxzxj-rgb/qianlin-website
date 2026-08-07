import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFile(path.join(projectRoot, file), "utf8");

const [schema, adminInquiries, listRoute, detailRoute, dashboard, manager, detail, readme, migration] = await Promise.all([
  read("db/schema.ts"),
  read("lib/admin/inquiries.ts"),
  read("app/api/admin/inquiries/route.ts"),
  read("app/api/admin/inquiries/[inquiryId]/route.ts"),
  read("lib/admin/getAdminDashboard.ts"),
  read("components/AdminInquiryManager.tsx"),
  read("components/AdminInquiryDetail.tsx"),
  read("README.md"),
  read("drizzle/0007_yielding_deathstrike.sql"),
]);

test("defines the complete 3G inquiry status workflow without a new table", () => {
  assert.match(schema, /ck_inquiries_status/);
  assert.match(schema, /following_up/);
  assert.match(schema, /completed/);
  assert.match(adminInquiries, /ADMIN_INQUIRY_STATUSES = \["new", "contacted", "following_up", "completed", "closed"\]/);
  assert.match(migration, /CREATE TABLE `__new_inquiries`/);
  assert.match(migration, /DROP TABLE `inquiries`/);
  assert.doesNotMatch(migration, /CREATE TABLE `inquiry/);
});

test("protects inquiry APIs with the fixed admin tenant and same origin writes", () => {
  assert.match(listRoute, /requireAdminSession/);
  assert.match(listRoute, /requireAdminTenant/);
  assert.match(listRoute, /getAdminInquiries/);
  assert.match(detailRoute, /requireAdminSession/);
  assert.match(detailRoute, /requireAdminTenant/);
  assert.match(detailRoute, /verifySameOriginRequest/);
  assert.match(detailRoute, /updateAdminInquiryStatus/);
  assert.doesNotMatch(detailRoute, /export async function DELETE/);
  assert.match(adminInquiries, /eq\(inquiries\.tenantId, ADMIN_TENANT_ID\)/);
  assert.match(adminInquiries, /eq\(inquiries\.id, inquiryId\)/);
  assert.match(adminInquiries, /maskPhone/);
  assert.match(adminInquiries, /maskEmail/);
});

test("keeps list fields masked and detail fields restricted to the detail page", () => {
  assert.match(manager, /contactSummary/);
  assert.match(manager, /pagination/);
  assert.doesNotMatch(manager, /item\.phone|item\.wechat|item\.email|item\.message/);
  assert.match(detail, /inquiry\.phone/);
  assert.match(detail, /inquiry\.wechat/);
  assert.match(detail, /inquiry\.email/);
  assert.match(detail, /inquiry\.message/);
  assert.match(dashboard, /followingUpInquiries/);
  assert.match(dashboard, /todayNewInquiries/);
});

test("documents 3G as completed while retaining later stage boundaries", () => {
  assert.match(readme, /第三阶段 3G：后台咨询管理 MVP 已完成/);
  assert.match(readme, /永久删除/);
  assert.match(readme, /不包含订单或支付系统/);
});
