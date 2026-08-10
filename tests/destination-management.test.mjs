import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFile(path.join(projectRoot, file), "utf8");

test("keeps destination data tenant scoped and images server owned", async () => {
  const [schema, service, page, api, updateApi, manager, options, provider, localProvider, migration, wrapper] = await Promise.all([
    read("db/schema.ts"),
    read("lib/admin/destinations.ts"),
    read("app/admin/destinations/page.tsx"),
    read("app/api/admin/destinations/route.ts"),
    read("app/api/admin/destinations/[destinationId]/route.ts"),
    read("components/AdminDestinationManager.tsx"),
    read("lib/planner/getOptionsForTenant.ts"),
    read("components/PlannerOptionsProvider.tsx"),
    read("lib/itinerary/providers/localItineraryProvider.ts"),
    read("drizzle/0010_add_tenant_province_catalog.sql"),
    read("app/api/admin/t/[tenantSlug]/destinations/route.ts"),
  ]);

  assert.match(schema, /plannerDestinations = sqliteTable\("planner_destinations"/);
  assert.match(schema, /tenantId: text\("tenant_id"\).*references\(\(\) => tenants\.id/);
  assert.match(schema, /uq_planner_destinations_tenant_slug/);
  assert.match(service, /ADMIN_DESTINATION_FIELDS/);
  assert.doesNotMatch(service, /ADMIN_DESTINATION_PROVINCE_CODE/);
  assert.match(service, /destinationWriteValues\(values, current\.imageUrl, values\.showOnHomepage\)/);
  assert.match(service, /destinationWriteValues\(values, "", false\)/);
  assert.match(service, /isAdminImagePathForUsage\(row\.imageUrl, "destination"\)/);
  assert.match(service, /eq\(plannerDestinations\.id, destinationId\)/);
  assert.match(service, /eq\(plannerDestinations\.tenantId, tenantId\)/);
  assert.match(service, /AdminDestinationImageError/);
  assert.match(service, /recommendedVisitHours/);
  assert.match(service, /Number\.isInteger\(value\)/);
  assert.match(page, /getAdminPageAccess/);
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(manager, /hasHomepageImage/);
  assert.doesNotMatch(manager, /admin-destination-summary-image|AdminImagePreview|getAdminImageOptions/);
  assert.doesNotMatch(manager, /tenantId|tenant_id|provinceCode|province_code/);
  assert.match(api, /readAdminJsonRequest/);
  assert.match(api, /getAdminRouteAccess/);
  assert.match(updateApi, /AdminDestinationNotFoundError/);
  assert.match(options, /eq\(plannerDestinations\.tenantId, tenant\.id\)/);
  assert.doesNotMatch(options, /provinceCode, "guizhou"/);
  assert.match(options, /isAdminImagePathForUsage\(destination\.imageUrl, "destination"\)/);
  assert.match(provider, /isPlannerDestination/);
  assert.match(provider, /recommendedVisitHours/);
  assert.match(localProvider, /route order|routeOrder/i);
  assert.doesNotMatch(localProvider, /recommendedVisitHours.*sort|sort.*recommendedVisitHours/);
  assert.match(migration, /yunnan/);
  assert.match(wrapper, /@\/app\/api\/admin\/destinations\/route/);
});

test("strictly validates planner destination response fields", async () => {
  const provider = await read("components/PlannerOptionsProvider.tsx");
  assert.match(provider, /cardSize === "small" \|\| value\.cardSize === "large"/);
  assert.match(provider, /isIntegerInRange\(value\.routeOrder, 0, 1000\)/);
  assert.match(provider, /isIntegerInRange\(value\.recommendedVisitHours, 1, 48\)/);
  assert.match(provider, /typeof value\.majorAttraction === "boolean"/);
  assert.match(provider, /typeof value\.availableForPlanning === "boolean"/);
  assert.match(provider, /typeof value\.showOnHomepage === "boolean"/);
});
