import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFile(path.join(projectRoot, file), "utf8");

test("uses the verified tenant context for contact administration", async () => {
  const [auth, page, manager, route, service, dashboard, wrapper, http] = await Promise.all([
    read("lib/admin/auth.ts"),
    read("app/admin/contacts/page.tsx"),
    read("components/AdminContactManager.tsx"),
    read("app/api/admin/contacts/route.ts"),
    read("lib/admin/contacts.ts"),
    read("components/AdminDashboard.tsx"),
    read("app/api/admin/t/[tenantSlug]/contacts/route.ts"),
    read("scripts/test-local-http.mjs"),
  ]);

  assert.match(auth, /sessions/);
  assert.match(auth, /tenantMemberships/);
  assert.match(auth, /requireAdminAccess/);
  assert.match(auth, /SUPPORTED_ADMIN_TENANT_ID\s*=\s*["']qianlin-travel/);
  assert.match(page, /getAdminPageAccess/);
  assert.match(page, /force-no-store/);
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(page, /alternates: null/);
  assert.match(page, /openGraph: null/);
  assert.match(manager, /adminApiPath/);
  assert.match(manager, /AdminLogoutButton isDirty=\{isDirty\} disabled=\{pending\}/);
  assert.match(manager, /useAdminUnsavedChanges/);
  assert.doesNotMatch(manager, /localStorage|sessionStorage/);
  assert.doesNotMatch(manager, /tenantId|tenant_id|ownerId|isDemo/);
  assert.match(route, /getAdminRouteAccess/);
  assert.match(route, /readAdminJsonRequest/);
  assert.match(route, /Cache-Control.*no-store/);
  assert.match(service, /ADMIN_CONTACT_TYPES = \["phone", "wechat", "email"\]/);
  assert.match(service, /current\.type !== value\.type/);
  assert.match(service, /new Set\(values\.map\(\(value\) => value\.type\)\)/);
  assert.match(service, /tel:\+86/);
  assert.match(service, /mailto:/);
  assert.match(service, /ENCODED_CONTROL_CHARACTER_PATTERN/);
  assert.match(service, /eq\(tenantContactChannels\.id, value\.id\)/);
  assert.match(service, /eq\(tenantContactChannels\.tenantId, tenantId\)/);
  assert.match(service, /db\.batch/);
  assert.match(dashboard, /adminBase/);
  assert.match(dashboard, /contacts/);
  assert.match(wrapper, /@\/app\/api\/admin\/contacts\/route/);
  assert.match(http, /changedType/);
  assert.match(http, /duplicatePhone/);
  assert.match(http, /phoneMismatch/);
  assert.match(http, /emailMismatch/);
  assert.match(http, /%0d/);
  assert.match(http, /%0a/);
  assert.match(http, /originalYunnanContacts/);
});
