import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFile(path.join(projectRoot, file), "utf8");

test("keeps tours tenant scoped and image values server validated", async () => {
  const [schema, service, imageCatalog, api, updateApi, manager, resolver, types, home, migration, wrapper] = await Promise.all([
    read("db/schema.ts"),
    read("lib/admin/tours.ts"),
    read("lib/admin/imageCatalog.ts"),
    read("app/api/admin/tours/route.ts"),
    read("app/api/admin/tours/[tourId]/route.ts"),
    read("components/AdminTourManager.tsx"),
    read("lib/tenancy/resolveTenant.ts"),
    read("lib/tenancy/types.ts"),
    read("components/TenantHomeClient.tsx"),
    read("drizzle/0006_breezy_blink.sql"),
    read("app/api/admin/t/[tenantSlug]/tours/route.ts"),
  ]);
  assert.match(schema, /tenantTours = sqliteTable\("tenant_tours"/);
  assert.match(schema, /uq_tenant_tours_tenant_slug/);
  assert.match(schema, /ck_tenant_tours_display_order/);
  assert.match(migration, /CREATE TABLE `tenant_tours`/);
  assert.match(service, /ADMIN_TOUR_FIELDS/);
  assert.match(service, /ADMIN_TOUR_STATUSES/);
  assert.match(service, /eq\(tenantTours\.id, tourId\)/);
  assert.match(service, /eq\(tenantTours\.tenantId, tenantId\)/);
  assert.match(api, /getAdminRouteAccess/);
  assert.match(api, /readAdminJsonRequest/);
  assert.match(updateApi, /AdminTourNotFoundError/);
  assert.match(manager, /adminApiPath/);
  assert.match(imageCatalog, /isAdminImagePathForUsage/);
  assert.match(resolver, /eq\(tenantTours\.tenantId, tenant\.id\)/);
  assert.match(resolver, /eq\(tenantTours\.status, "published"\)/);
  assert.match(types, /tours: Tour\[\]/);
  assert.match(home, /getVisibleTours\(siteConfig\.tours, siteConfig\.tenant\.id\)/);
  assert.match(wrapper, /@\/app\/api\/admin\/tours\/route/);
  const output = ts.transpileModule(await read("lib/tours.ts"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const tours = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
  const visible = tours.getVisibleTours([
    { id: "b", tenantId: "tenant-a", slug: "b-tour", title: { zh: "B", en: "B" }, description: { zh: "B", en: "B" }, featured: true, displayOrder: 1, status: "published" },
    { id: "a", tenantId: "tenant-a", slug: "a-tour", title: { zh: "A", en: "A" }, description: { zh: "A", en: "A" }, featured: true, displayOrder: 1, status: "published" },
    { id: "other", tenantId: "tenant-b", slug: "other-tour", title: { zh: "Other", en: "Other" }, description: { zh: "Other", en: "Other" }, featured: true, displayOrder: 0, status: "published" },
  ], "tenant-a");
  assert.deepEqual(visible.map((tour) => tour.id), ["a", "b"]);
});
