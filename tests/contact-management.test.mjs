import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFile(path.join(projectRoot, relativePath), "utf8");

test("keeps 3D contact management fixed to existing safe channels and qianlin-travel", async () => {
  const [page, manager, route, service, dashboard, layout] = await Promise.all([
    read("app/admin/contacts/page.tsx"),
    read("components/AdminContactManager.tsx"),
    read("app/api/admin/contacts/route.ts"),
    read("lib/admin/contacts.ts"),
    read("components/AdminDashboard.tsx"),
    read("app/admin/layout.tsx"),
  ]);

  assert.match(page, /getAdminSessionFromCookie/);
  assert.match(page, /redirect\("\/admin\/login"\)/);
  assert.match(page, /force-no-store/);
  assert.match(page, /title: "联系方式管理 \| 黔林旅行社"/);
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(page, /alternates: null/);
  assert.match(page, /openGraph: null/);
  assert.match(manager, /类型/);
  assert.match(manager, /中文显示名称/);
  assert.match(manager, /英文显示名称/);
  assert.match(manager, /联系方式内容/);
  assert.match(manager, /跳转链接/);
  assert.match(manager, /显示顺序/);
  assert.match(manager, /状态/);
  assert.match(manager, /正在保存联系方式/);
  assert.match(manager, /disabled=\{pending \|\| !isDirty\}/);
  assert.match(manager, /window\.confirm/);
  assert.match(manager, /sessionExpired/);
  assert.doesNotMatch(manager, /dangerouslySetInnerHTML|localStorage|sessionStorage/);
  assert.doesNotMatch(manager, /tenantId|tenant_id|tenantSlug|ownerId|isDemo/);
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function PUT/);
  assert.match(route, /readAdminJsonRequest/);
  assert.match(route, /Cache-Control.*no-store/);
  assert.match(route, /AdminContactConfigurationError/);
  assert.match(service, /ADMIN_CONTACT_TYPES = \["phone", "wechat", "email"\]/);
  assert.match(service, /ADMIN_CONTACT_STATUSES = \["draft", "published", "archived"\]/);
  assert.match(service, /MAINLAND_PHONE_PATTERN/);
  assert.match(service, /EMAIL_PATTERN/);
  assert.match(service, /javascript/);
  assert.match(service, /data/);
  assert.match(service, /blob/);
  assert.match(service, /ADMIN_CONTACT_FIELDS/);
  assert.match(service, /db\.batch/);
  assert.match(service, /eq\(tenantContactChannels\.id, value\.id\)/);
  assert.match(service, /eq\(tenantContactChannels\.tenantId, tenantId\)/);
  assert.match(service, /updatedAt: sql`CURRENT_TIMESTAMP`/);
  assert.match(dashboard, /href="\/admin\/contacts"/);
  assert.match(layout, /alternates: null/);
  assert.match(layout, /openGraph: null/);
});
