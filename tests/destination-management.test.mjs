import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFile(path.join(projectRoot, file), "utf8");

const [schema, service, page, api, updateApi, manager, guard, options, optionsRoute, provider, destinations, localProvider, dashboard, readme, packageJson] = await Promise.all([
  read("db/schema.ts"),
  read("lib/admin/destinations.ts"),
  read("app/admin/destinations/page.tsx"),
  read("app/api/admin/destinations/route.ts"),
  read("app/api/admin/destinations/[destinationId]/route.ts"),
  read("components/AdminDestinationManager.tsx"),
  read("components/useAdminUnsavedChanges.ts"),
  read("lib/planner/getOptionsForTenant.ts"),
  read("app/api/t/[tenantSlug]/planner/options/route.ts"),
  read("components/PlannerOptionsProvider.tsx"),
  read("components/Destinations.tsx"),
  read("lib/itinerary/providers/localItineraryProvider.ts"),
  read("components/AdminDashboard.tsx"),
  read("README.md"),
  read("package.json"),
]);

test("uses the existing tenant-scoped destination table without a new migration", () => {
  assert.match(schema, /plannerDestinations = sqliteTable\("planner_destinations"/);
  assert.match(schema, /tenantId: text\("tenant_id"\)\.notNull\(\)\.references\(\(\) => tenants\.id, \{ onDelete: "restrict" \}\)/);
  assert.match(schema, /tenantSlugUnique: uniqueIndex\("uq_planner_destinations_tenant_slug"\)\.on\(table\.tenantId, table\.slug\)/);
  assert.match(schema, /planningOrderIndex/);
  assert.match(schema, /homepageOrderIndex/);
  assert.doesNotMatch(service, /ALTER TABLE|drizzle\/0007|tenantDestinations/);
});

test("keeps destination writes server-owned and tenant-scoped", () => {
  assert.match(service, /ADMIN_DESTINATION_FIELDS/);
  assert.match(service, /ADMIN_DESTINATION_PROVINCE_CODE = "guizhou"/);
  assert.match(service, /isAdminImagePathForUsage\(row\.imageUrl, "destination"\)/);
  assert.match(service, /hasHomepageImage/);
  assert.doesNotMatch(service, /"imageUrl"\s*,/);
  assert.match(service, /destinationWriteValues\(values, "", false\)/);
  assert.match(service, /destinationWriteValues\(values, current\.imageUrl, values\.showOnHomepage\)/);
  assert.match(service, /AdminDestinationImageError/);
  assert.match(service, /SAFE_CODE_PATTERN/);
  assert.match(service, /recommendedVisitHours/);
  assert.match(service, /typeof value !== "boolean"/);
  assert.match(service, /Number\.isInteger\(value\)/);
  assert.match(service, /eq\(plannerDestinations\.tenantId, tenantId\)/);
  assert.match(service, /eq\(plannerDestinations\.id, destinationId\)/);
  assert.match(service, /where\(and\(eq\(plannerDestinations\.id, destinationId\), eq\(plannerDestinations\.tenantId, tenantId\)\)\)/);
  assert.match(service, /crypto\.randomUUID\(\)/);
  assert.match(service, /eq\(plannerCities\.tenantId, tenantId\)/);
  assert.match(service, /provinceCode: ADMIN_DESTINATION_PROVINCE_CODE/);
  assert.doesNotMatch(service, /tenantId: body\.tenantId|tenantId: values\.tenantId|provinceCode: values\./);
  assert.match(api, /readAdminJsonRequest/);
  assert.match(api, /requireAdminSession/);
  assert.match(api, /Cache-Control.*no-store/);
  assert.match(updateApi, /AdminDestinationNotFoundError/);
  assert.match(updateApi, /AdminDestinationCityError/);
});

test("keeps the admin destination page private and usable on mobile", () => {
  assert.match(page, /getAdminSessionFromCookie/);
  assert.match(page, /redirect\("\/admin\/login"\)/);
  assert.match(page, /force-no-store/);
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(page, /alternates: null/);
  assert.match(page, /openGraph: null/);
  assert.match(manager, /已有目的地/);
  assert.match(manager, /新增目的地/);
  assert.match(manager, /状态筛选/);
  assert.match(manager, /hasHomepageImage/);
  assert.match(manager, /当前目的地没有首页图片，只能用于行程规划/);
  assert.match(manager, /destination\.nameZh/);
  assert.match(manager, /destination\.nameEn/);
  assert.match(manager, /首页/);
  assert.match(manager, /规划/);
  assert.match(manager, /编辑目的地/);
  assert.doesNotMatch(manager, /admin-destination-summary-image|AdminImagePreview|getAdminImageOptions/);
  assert.match(manager, /贵州 \/ Guizhou/);
  assert.match(manager, /useAdminUnsavedChanges/);
  assert.match(manager, /AdminLogoutButton isDirty=\{isDirty\} disabled=\{pending\}/);
  assert.match(manager, /aria-describedby/);
  assert.doesNotMatch(manager, /localStorage|sessionStorage/);
  assert.doesNotMatch(manager, /tenantId|tenant_id|tenantSlug|provinceCode|province_code/);
  assert.match(guard, /beforeunload/);
  assert.match(guard, /popstate/);
  assert.match(guard, /history\.back/);
  assert.match(guard, /adminUnsavedGuardId/);
  assert.match(guard, /guardRef/);
  assert.match(dashboard, /href="\/admin\/destinations"/);
});

test("keeps planner options fresh, structured, and consistent with destination rules", () => {
  assert.match(options, /eq\(plannerDestinations\.tenantId, tenant\.id\)/);
  assert.match(options, /eq\(plannerDestinations\.provinceCode, "guizhou"\)/);
  assert.match(options, /eq\(plannerDestinations\.status, "published"\)/);
  assert.match(options, /asc\(plannerDestinations\.routeOrder\)/);
  assert.match(options, /asc\(plannerDestinations\.displayOrder\)/);
  assert.match(optionsRoute, /Cache-Control.*no-store/);
  assert.match(options, /isAdminImagePathForUsage\(destination\.imageUrl, "destination"\)/);
  assert.match(provider, /isPlannerDestination/);
  assert.match(provider, /isAdminImagePathForUsage\(value\.imageUrl, "destination"\)/);
  assert.match(provider, /routeOrder/);
  assert.match(provider, /recommendedVisitHours/);
  assert.match(provider, /availableForPlanning/);
  assert.match(destinations, /showOnHomepage/);
  assert.match(destinations, /displayOrder/);
  assert.match(localProvider, /left\.routeOrder - right\.routeOrder/);
  assert.match(localProvider, /left\.displayOrder - right\.displayOrder/);
  assert.match(localProvider, /根据景点区域和线路顺序自动整理/);
  assert.doesNotMatch(localProvider, /根据景点区域和建议游玩时长自动整理/);
});

test("documents the deliberately excluded destination capabilities", () => {
  assert.match(readme, /第三阶段 3F：后台目的地管理/);
  assert.match(readme, /不提供图片新增或修改/);
  assert.match(readme, /已有首页目的地图片继续保留/);
  assert.match(readme, /建议游览时长目前仅作为参考资料/);
  assert.match(readme, /不支持省份和城市管理/);
  assert.match(readme, /地图、门票、开放时间、实时车程/);
  assert.match(readme, /第三阶段 3G：后台咨询管理 MVP 已完成/);
  assert.match(packageJson, /destination-management\.test\.mjs/);
});
