import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFile(path.join(projectRoot, file), "utf8");
const [schema, migration, service, imageCatalog, page, api, updateApi, manager, guard, resolver, types, home, dashboard, readme] = await Promise.all([
  read("db/schema.ts"),
  read("drizzle/0006_breezy_blink.sql"),
  read("lib/admin/tours.ts"),
  read("lib/admin/imageCatalog.ts"),
  read("app/admin/tours/page.tsx"),
  read("app/api/admin/tours/route.ts"),
  read("app/api/admin/tours/[tourId]/route.ts"),
  read("components/AdminTourManager.tsx"),
  read("components/useAdminUnsavedChanges.ts"),
  read("lib/tenancy/resolveTenant.ts"),
  read("lib/tenancy/types.ts"),
  read("components/TenantHomeClient.tsx"),
  read("components/AdminDashboard.tsx"),
  read("README.md"),
]);

test("defines a tenant-scoped tour table and a safe migration", () => {
  assert.match(schema, /tenantTours = sqliteTable\("tenant_tours"/);
  assert.match(schema, /tenantId: text\("tenant_id"\)\.notNull\(\)\.references\(\(\) => tenants\.id, \{ onDelete: "restrict" \}\)/);
  assert.match(schema, /tenantSlugUnique: uniqueIndex\("uq_tenant_tours_tenant_slug"\)\.on\(table\.tenantId, table\.slug\)/);
  assert.match(schema, /ck_tenant_tours_status/);
  assert.match(schema, /ck_tenant_tours_featured/);
  assert.match(schema, /ck_tenant_tours_display_order/);
  assert.match(migration, /CREATE TABLE `tenant_tours`/);
  assert.match(migration, /FOREIGN KEY \(`tenant_id`\) REFERENCES `tenants`\(`id`\).*ON DELETE restrict/s);
  assert.match(migration, /uq_tenant_tours_tenant_slug/);
  assert.match(migration, /idx_tenant_tours_tenant_status_featured_order/);
  assert.match(migration, /idx_tenant_tours_tenant_status_order/);
  assert.doesNotMatch(migration, /INSERT INTO `tenant_tours`/);
});

test("keeps admin tour validation and tenant writes server-owned", () => {
  assert.match(service, /ADMIN_TOUR_FIELDS/);
  assert.match(service, /SLUG_PATTERN/);
  assert.match(service, /isAdminImagePathForUsage\(normalizedValue, "tour"\)/);
  assert.match(service, /typeof value !== "boolean"/);
  assert.match(service, /Number\.isInteger\(value\)/);
  assert.match(service, /ADMIN_TOUR_STATUSES/);
  assert.match(service, /crypto\.randomUUID\(\)/);
  assert.match(service, /eq\(tenantTours\.id, tourId\)/);
  assert.match(service, /eq\(tenantTours\.tenantId, tenantId\)/);
  assert.match(service, /where\(and\(eq\(tenantTours\.id, tourId\), eq\(tenantTours\.tenantId, tenantId\)\)\)/);
  assert.match(api, /requireAdminSession/);
  assert.match(api, /readAdminJsonRequest/);
  assert.match(api, /Cache-Control.*no-store/);
  assert.match(updateApi, /AdminTourNotFoundError/);
  assert.match(manager, /encodeURIComponent\(tourId\)/);
  assert.doesNotMatch(service, /tenantId: body\.tenantId|tenantId: values\.tenantId/);
});

test("keeps the admin page private, separate, and protected from unsaved navigation", () => {
  assert.match(page, /redirect\("\/admin\/login"\)/);
  assert.match(page, /force-no-store/);
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(page, /alternates: null/);
  assert.match(page, /openGraph: null/);
  assert.match(manager, /新增线路/);
  assert.match(manager, /已有线路/);
  assert.match(manager, /线路数据已加载/);
  assert.match(manager, /保存中/);
  assert.match(manager, /useAdminUnsavedChanges/);
  assert.match(guard, /beforeunload/);
  assert.match(guard, /popstate/);
  assert.match(guard, /history\.pushState/);
  assert.match(manager, /AdminLogoutButton isDirty=\{isDirty\} disabled=\{pending\}/);
  assert.match(manager, /label htmlFor/);
  assert.doesNotMatch(manager, /tenantId|tenant_id|tenantSlug|localStorage|sessionStorage/);
});

test("limits image selection to the built-in tour whitelist", () => {
  assert.match(imageCatalog, /AdminImageUsage = "hero" \| "about" \| "customize" \| "tour" \| "destination"/);
  assert.match(imageCatalog, /getAdminImageOptions/);
  assert.match(imageCatalog, /isAdminImagePathForUsage/);
  assert.match(manager, /getAdminImageOptions\("tour"\)/);
  assert.match(manager, /AdminImagePreview/);
});

test("passes database tours to the homepage filter and preserves deterministic ordering", async () => {
  assert.match(types, /tours: Tour\[\]/);
  assert.match(resolver, /tenantTours/);
  assert.match(resolver, /eq\(tenantTours\.tenantId, tenant\.id\)/);
  assert.match(resolver, /eq\(tenantTours\.status, "published"\)/);
  assert.match(resolver, /tours: tourRows\.map/);
  assert.match(home, /getVisibleTours\(siteConfig\.tours, siteConfig\.tenant\.id\)/);
  assert.match(home, /visibleTours\.length/);
  assert.match(dashboard, /data\.counts\.tours/);
  const output = ts.transpileModule(await read("lib/tours.ts"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const tours = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
  const visible = tours.getVisibleTours([
    { id: "b", tenantId: "qianlin-travel", slug: "b-tour", title: { zh: "B", en: "B" }, description: { zh: "B", en: "B" }, featured: true, displayOrder: 1, status: "published" },
    { id: "a", tenantId: "qianlin-travel", slug: "a-tour", title: { zh: "A", en: "A" }, description: { zh: "A", en: "A" }, featured: true, displayOrder: 1, status: "published" },
    { id: "draft", tenantId: "qianlin-travel", slug: "draft-tour", title: { zh: "Draft", en: "Draft" }, description: { zh: "Draft", en: "Draft" }, featured: true, displayOrder: 0, status: "draft" },
    { id: "other", tenantId: "yunnan-demo", slug: "other-tour", title: { zh: "Other", en: "Other" }, description: { zh: "Other", en: "Other" }, featured: true, displayOrder: 0, status: "published" },
  ], "qianlin-travel");
  assert.deepEqual(visible.map((tour) => tour.id), ["a", "b"]);
});

test("documents the deliberately excluded tour capabilities", () => {
  assert.match(readme, /线路管理已完成/);
  assert.match(readme, /图片只能选择项目内置白名单/);
  assert.match(readme, /不支持详细每日行程/);
  assert.match(readme, /咨询管理仍未开放/);
});
