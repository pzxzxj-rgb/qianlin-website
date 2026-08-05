import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFile(path.join(projectRoot, file), "utf8");
const [schema, migration, resolver, siteRoute, plannerRoute, inquiryRoute, home, dynamicPage, provider, plannerProvider, sitemap, rootPage, siteUrl] = await Promise.all([
  read("db/schema.ts"),
  read("drizzle/0004_numerous_captain_flint.sql"),
  read("lib/tenancy/resolveTenant.ts"),
  read("app/api/t/[tenantSlug]/site-config/route.ts"),
  read("app/api/t/[tenantSlug]/planner/options/route.ts"),
  read("app/api/t/[tenantSlug]/inquiries/route.ts"),
  read("components/TenantHomeClient.tsx"),
  read("app/t/[tenantSlug]/page.tsx"),
  read("components/TenantSiteProvider.tsx"),
  read("components/PlannerOptionsProvider.tsx"),
  read("app/sitemap.ts"),
  read("app/page.tsx"),
  read("lib/siteUrl.ts"),
]);

test("defines tenants before child tables and removes the inquiry default tenant", () => {
  assert.ok(schema.indexOf("export const tenants") < schema.indexOf("export const inquiries"));
  assert.match(schema, /tenantId: text\("tenant_id"\)\.notNull\(\)\.references\(\(\) => tenants\.id/);
  assert.match(schema, /siteStatus: text\("site_status"\)/);
  assert.match(schema, /ck_tenants_status/);
  assert.match(schema, /ck_tenants_site_status/);
  assert.match(schema, /ck_tenants_default_language/);
  for (const table of ["tenant_site_profiles", "tenant_contact_channels", "tenant_hero_slides", "planner_cities", "planner_destinations"]) {
    const start = schema.indexOf(`sqliteTable("${table}"`);
    const end = schema.indexOf("export const", start + 1);
    assert.match(schema.slice(start, end < 0 ? undefined : end), /references\(\(\) => tenants\.id, \{ onDelete: "restrict" \}\)/, table);
  }
  assert.match(migration, /COALESCE\(NULLIF\(`tenant_id`, ''\), 'qianlin-travel'\)/);
  assert.match(migration, /site_status.*'published'/s);
  assert.match(migration, /Yuntu Travel Demo/);
  assert.match(migration, /idx_inquiries_tenant_status_created/);
});

test("resolves active tenants by database slug and isolates all tenant APIs", () => {
  assert.match(resolver, /eq\(tenants\.slug, slug\)/);
  assert.match(resolver, /eq\(tenants\.status, "active"\)/);
  assert.match(resolver, /siteStatus/);
  assert.doesNotMatch(resolver, /if \(slug ===/);
  assert.match(resolver, /function unconfiguredSiteConfig/);
  assert.match(resolver, /contacts: \[\]/);
  assert.match(resolver, /heroSlides: \[\]/);
  assert.match(siteRoute, /getTenantSiteConfig/);
  assert.match(siteRoute, /no-store/);
  assert.match(plannerRoute, /resolveActiveTenantBySlug/);
  assert.match(inquiryRoute, /resolveActiveTenantBySlug/);
  assert.match(inquiryRoute, /tenant\.isDemo \|\| tenant\.siteStatus !== "published"/);
  assert.match(home, /siteConfig\.tenant\.isDemo/);
  assert.match(home, /!siteConfig\.isConfigured/);
  assert.match(dynamicPage, /robots: isPublic \? undefined : \{ index: false, follow: false \}/);
  assert.match(provider, /AbortController/);
  assert.match(provider, /value\.tenant\.slug !== tenantSlug/);
  assert.match(provider, /isRefreshing/);
  assert.match(plannerProvider, /AbortController/);
  assert.match(plannerProvider, /value\.tenantSlug !== tenantSlug/);
});

test("only publishes tenants with valid public profiles and uses safe URL metadata", () => {
  assert.match(sitemap, /tenantSiteProfiles/);
  assert.match(sitemap, /tenantSiteProfiles\.status, "published"/);
  assert.match(sitemap, /tenantSiteProfiles\.companyNameZh/);
  assert.match(sitemap, /eq\(tenants\.isDemo, false\)/);
  assert.match(rootPage, /robots: \{ index: false, follow: false \}/);
  assert.match(siteUrl, /NEXT_PUBLIC_SITE_URL must be set/);
});
