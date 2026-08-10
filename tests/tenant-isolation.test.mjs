import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFile(path.join(projectRoot, file), "utf8");

test("defines database identity and tenant boundaries", async () => {
  const [schema, auth, routeAccess, scope, migration, resolver, siteRoute, plannerRoute, inquiryRoute, home, dynamicPage, siteProvider, plannerProvider, sitemap, siteUrl, http] = await Promise.all([
    read("db/schema.ts"),
    read("lib/admin/auth.ts"),
    read("lib/admin/routeAccess.ts"),
    read("lib/admin/tenantScope.ts"),
    read("drizzle/0008_saas_identity_and_tenant_governance.sql"),
    read("lib/tenancy/resolveTenant.ts"),
    read("app/api/t/[tenantSlug]/site-config/route.ts"),
    read("app/api/t/[tenantSlug]/planner/options/route.ts"),
    read("app/api/t/[tenantSlug]/inquiries/route.ts"),
    read("components/TenantHomeClient.tsx"),
    read("app/t/[tenantSlug]/page.tsx"),
    read("components/TenantSiteProvider.tsx"),
    read("components/PlannerOptionsProvider.tsx"),
    read("app/sitemap.ts"),
    read("lib/siteUrl.ts"),
    read("scripts/test-local-http.mjs"),
  ]);
  for (const table of ["users", "tenant_memberships", "sessions", "admin_audit_logs", "tenant_legal_pages", "tenant_quotas"]) assert.match(schema, new RegExp(`sqliteTable\\("${table}"`));
  assert.match(schema, /sessions/);
  assert.match(schema, /revokedAt/);
  assert.match(schema, /owner.*admin.*editor.*viewer/s);
  assert.match(auth, /getSessionRows/);
  assert.match(auth, /isNull\(sessions\.revokedAt\)/);
  assert.match(auth, /tenantMemberships/);
  assert.match(auth, /requireAdminAccess/);
  assert.doesNotMatch(auth, /ADMIN_TENANT_ID\s*=\s*["']qianlin-travel/);
  assert.match(routeAccess, /getTenantSlugFromAdminPath/);
  assert.match(routeAccess, /requireAdminAccess/);
  assert.match(scope, /assertTenantScope/);
  assert.match(migration, /CREATE TABLE `users`/);
  assert.match(migration, /CREATE TABLE `tenant_memberships`/);
  assert.match(migration, /CREATE TABLE `sessions`/);
  assert.match(resolver, /eq\(tenants\.slug, slug\)/);
  assert.match(resolver, /eq\(tenants\.status, "active"\)/);
  assert.doesNotMatch(resolver, /if \(slug ===/);
  assert.match(siteRoute, /getTenantSiteConfig/);
  assert.match(plannerRoute, /resolveActiveTenantBySlug/);
  assert.match(inquiryRoute, /resolveActiveTenantBySlug/);
  assert.match(home, /!siteConfig\.isConfigured/);
  assert.match(dynamicPage, /robots: isPublic \? undefined :/);
  assert.match(siteProvider, /AbortController/);
  assert.match(siteProvider, /isRefreshing/);
  assert.match(plannerProvider, /AbortController/);
  assert.match(plannerProvider, /value\.tenantSlug !== tenantSlug/);
  assert.match(sitemap, /tenantSiteProfiles/);
  assert.match(siteUrl, /NEXT_PUBLIC_SITE_URL must be set/);
  assert.match(http, /yunnanSessionCookie/);
  assert.match(http, /yunnanCrossTenant/);
  assert.match(http, /qianlinCrossTenant/);
});
