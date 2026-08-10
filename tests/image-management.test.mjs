import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFile(path.join(projectRoot, file), "utf8");

test("keeps image management local and tenant scoped", async () => {
  const [page, manager, catalog, images, request, heroRoute, profileRoute, migration] = await Promise.all([
    read("app/admin/images/page.tsx"),
    read("components/AdminImageManager.tsx"),
    read("lib/admin/imageCatalog.ts"),
    read("lib/admin/images.ts"),
    read("lib/admin/imageRequest.ts"),
    read("app/api/admin/images/hero/route.ts"),
    read("app/api/admin/images/profile/route.ts"),
    read("drizzle/0008_saas_identity_and_tenant_governance.sql"),
  ]);
  assert.match(page, /getAdminPageAccess/);
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(manager, /beforeunload/);
  assert.match(catalog, /ADMIN_IMAGE_CATALOG/);
  assert.doesNotMatch(catalog, /https?:\/\/|\.svg/);
  assert.match(images, /tenantHeroSlides\.tenantId/);
  assert.match(images, /tenantSiteProfiles\.tenantId/);
  assert.match(images, /eq\(tenantHeroSlides\.tenantId, tenantId\)/);
  assert.match(images, /eq\(tenantSiteProfiles\.tenantId, tenantId\)/);
  assert.match(images, /db\.batch/);
  assert.match(request, /getAdminRouteAccess/);
  assert.match(request, /verifySameOriginRequest/);
  assert.match(request, /application\/json/);
  assert.match(heroRoute, /24 \* 1024/);
  assert.match(profileRoute, /16 \* 1024/);
  assert.match(migration, /og_image_url/);

  const output = ts.transpileModule(catalog, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const imageCatalog = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
  assert.equal(imageCatalog.isAdminImagePath("/images/hero/hero-01.webp"), true);
  assert.equal(imageCatalog.isAdminImagePath("/images/not-in-catalog.webp"), false);
  assert.equal(imageCatalog.isAdminImagePath("https://example.com/image.webp"), false);
  assert.equal(imageCatalog.isAdminImagePath("/images/hero/../secret.webp"), false);
  assert.equal(imageCatalog.isAdminImagePath("/images/%2e%2e/secret.webp"), false);
});
