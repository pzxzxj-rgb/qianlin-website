import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFile(path.join(projectRoot, file), "utf8");
const [schema, migration, resolver, siteRoute, plannerRoute, inquiryRoute, home, dynamicPage, form, provider] = await Promise.all([
  read("db/schema.ts"),
  read("drizzle/0003_early_bedlam.sql"),
  read("lib/tenancy/resolveTenant.ts"),
  read("app/api/t/[tenantSlug]/site-config/route.ts"),
  read("app/api/t/[tenantSlug]/planner/options/route.ts"),
  read("app/api/t/[tenantSlug]/inquiries/route.ts"),
  read("components/TenantHomeClient.tsx"),
  read("app/t/[tenantSlug]/page.tsx"),
  read("components/CustomizeForm.tsx"),
  read("components/PlannerOptionsProvider.tsx"),
]);

test("creates tenant-scoped site and inquiry storage", () => {
  assert.match(schema, /tenants = sqliteTable\("tenants"/);
  assert.match(schema, /tenantSiteProfiles = sqliteTable\("tenant_site_profiles"/);
  assert.match(schema, /tenantContactChannels = sqliteTable\("tenant_contact_channels"/);
  assert.match(schema, /tenantHeroSlides = sqliteTable\("tenant_hero_slides"/);
  assert.match(schema, /tenantId: text\("tenant_id"\).*qianlin-travel/s);
  assert.match(migration, /'qianlin-travel'.*'Qianlin Travel'/s);
  assert.match(migration, /'yunnan-demo'.*'Yunnan Demo Travel'/s);
  assert.match(migration, /'qianlin-hero-01'/);
  assert.match(migration, /'qianlin-phone'/);
  assert.match(migration, /UPDATE `inquiries` SET `tenant_id` = 'qianlin-travel'/);
});

test("resolves active tenants by database slug without a fixed tenant union", () => {
  assert.match(resolver, /eq\(tenants\.slug, slug\)/);
  assert.match(resolver, /eq\(tenants\.status, "active"\)/);
  assert.doesNotMatch(resolver, /if \(slug ===/);
  assert.match(siteRoute, /resolveActiveTenantBySlug/);
  assert.match(plannerRoute, /resolveActiveTenantBySlug/);
  assert.match(inquiryRoute, /resolveActiveTenantBySlug/);
});

test("keeps demo tenants from reusing Qianlin operational data", () => {
  assert.match(inquiryRoute, /tenant\.isDemo/);
  assert.match(inquiryRoute, /does not accept real enquiries/);
  assert.match(home, /siteConfig\.tenant\.isDemo/);
  assert.match(home, /isDemo \? <About siteConfig=\{siteConfig\} \/>/);
  assert.match(home, /: <>\{hasVisibleTours/);
  assert.match(dynamicPage, /robots: tenant\.isDemo \? \{ index: false, follow: false \}/);
  assert.match(form, /\/api\/t\/\$\{encodeURIComponent\(tenantSlug\)\}\/inquiries/);
  assert.match(provider, /\/api\/t\/\$\{encodeURIComponent\(tenantSlug\)\}\/planner\/options/);
});
