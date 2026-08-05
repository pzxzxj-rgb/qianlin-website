import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFile(path.join(projectRoot, relativePath), "utf8");

test("keeps 3C image management local, fixed to two Hero slides, and tenant-safe", async () => {
  const [page, manager, heroForm, profileForm, preview, catalog, positions, images, request, heroRoute, profileRoute, dashboard, readme] = await Promise.all([
    read("app/admin/images/page.tsx"),
    read("components/AdminImageManager.tsx"),
    read("components/AdminHeroImagesForm.tsx"),
    read("components/AdminProfileImagesForm.tsx"),
    read("components/AdminImagePreview.tsx"),
    read("lib/admin/imageCatalog.ts"),
    read("lib/admin/imagePositions.ts"),
    read("lib/admin/images.ts"),
    read("lib/admin/imageRequest.ts"),
    read("app/api/admin/images/hero/route.ts"),
    read("app/api/admin/images/profile/route.ts"),
    read("components/AdminDashboard.tsx"),
    read("README.md"),
  ]);
  assert.match(page, /getAdminSessionFromCookie/);
  assert.match(page, /redirect\("\/admin\/login"\)/);
  assert.match(page, /force-no-store/);
  assert.match(page, /title: "网站图片管理 \| 黔林旅行社"/);
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(manager, /heroDirty/);
  assert.match(manager, /profileDirty/);
  assert.match(manager, /beforeunload/);
  assert.match(manager, /onClick=\{handleReturn\}/g);
  assert.match(manager, /confirmAdminImageNavigation\(isDirty\)/);
  assert.match(heroForm, /disabled=\{pending \|\| !isDirty\}/);
  assert.match(profileForm, /disabled=\{pending \|\| !isDirty\}/);
  assert.match(heroForm, /router\.refresh\(\)/);
  assert.match(profileForm, /router\.refresh\(\)/);
  assert.match(heroForm, /aria-describedby/);
  assert.match(profileForm, /aria-describedby/);
  assert.match(preview, /onError/);
  assert.match(preview, /admin-image-preview-fallback/);
  assert.match(catalog, /ADMIN_IMAGE_CATALOG/);
  assert.match(catalog, /\/images\/hero\/hero-01\.webp/);
  assert.match(catalog, /\/images\/guizhou\/huangguoshu\.png/);
  assert.doesNotMatch(catalog, /https?:\/\/|\.svg/);
  assert.match(positions, /center center/);
  assert.match(positions, /right center/);
  assert.match(images, /tenantHeroSlides\.tenantId, ADMIN_TENANT_ID/);
  assert.match(images, /tenantSiteProfiles\.tenantId, ADMIN_TENANT_ID/);
  assert.match(images, /updatedAt: sql`CURRENT_TIMESTAMP`/);
  assert.match(images, /db\.batch/);
  assert.match(images, /rows\.length !== 2/);
  assert.match(images, /isAdminImagePath/);
  assert.match(images, /HERO_IMAGE_POSITIONS/);
  assert.match(request, /requireAdminSession/);
  assert.match(request, /verifySameOriginRequest/);
  assert.match(request, /application\/json/);
  assert.match(heroRoute, /24 \* 1024/);
  assert.match(profileRoute, /16 \* 1024/);
  assert.match(heroRoute, /AdminImageConfigurationError/);
  assert.match(profileRoute, /updateAdminProfileImages/);
  assert.match(dashboard, /\/admin\/images/);
  assert.match(readme, /已完成网站图片管理/);
  assert.match(readme, /项目内置白名单/);
  assert.match(readme, /不支持电脑文件上传、R2/);

  const output = ts.transpileModule(catalog, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const imageCatalog = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
  assert.equal(imageCatalog.isAdminImagePath("/images/hero/hero-01.webp"), true);
  assert.equal(imageCatalog.isAdminImagePath("/images/not-in-catalog.webp"), false);
  assert.equal(imageCatalog.isAdminImagePath("https://example.com/image.webp"), false);
  assert.equal(imageCatalog.isAdminImagePath("/images/hero/../secret.webp"), false);
  assert.equal(imageCatalog.isAdminImagePath("/images/hero/hero-01.webp?x=1"), false);
  assert.equal(imageCatalog.isAdminImagePath("/images/%2e%2e/secret.webp"), false);
});
