import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHmac, pbkdf2Sync } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const statePath = path.resolve(root, ".wrangler", "http-test-state");
const configPath = path.resolve(root, "wrangler.local.jsonc");
const devVarsPath = path.resolve(root, ".dev.vars");
const port = 8790;
const baseUrl = `http://127.0.0.1:${port}`;
const adminTestUsername = "admin-test";
const adminTestPassword = "TestPassword!123";
const adminIterations = 600_000;
const adminSalt = Buffer.from("qianlin-admin-test-salt");
const adminSessionSecret = "local-admin-session-secret-for-tests-only";
const adminPasswordHash = `pbkdf2-sha256$${adminIterations}$${adminSalt.toString("base64url")}$${pbkdf2Sync(adminTestPassword, adminSalt, adminIterations, 32, "sha256").toString("base64url")}`;

function signedAdminCookie({ tenantId, expiresAt }) {
  const payload = JSON.stringify({ tenantId, expiresAt });
  const encodedPayload = Buffer.from(payload, "utf8").toString("base64url");
  const signature = createHmac("sha256", adminSessionSecret).update(payload).digest("base64url");
  return `qianlin_admin_session=${encodedPayload}.${signature}`;
}

function runWrangler(args) {
  return execFileSync(process.execPath, [wrangler, ...args], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function query(sql) {
  return JSON.parse(runWrangler(["d1", "execute", "DB", "--local", "--config", configPath, "--persist-to", statePath, "--json", "--command", sql]))[0]?.results ?? [];
}

function execute(sql) {
  runWrangler(["d1", "execute", "DB", "--local", "--config", configPath, "--persist-to", statePath, "--command", sql]);
}

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/t/qianlin-travel/site-config`);
      if (response.status === 200) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Local HTTP server did not become ready.");
}

async function request(pathname, init) {
  const response = await fetch(`${baseUrl}${pathname}`, init);
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { response, body };
}

const validPayload = {
  name: "Local functional test",
  phone: "18985127882",
  wechat: "",
  email: "",
  location: "贵阳",
  travelDate: "",
  travelers: "1",
  duration: "",
  tourName: "",
  places: "黄果树瀑布",
  message: "Local D1 functional test",
  website: "",
  privacyConsent: true,
  tenantId: "yunnan-demo",
  turnstileToken: "",
};

let server;
let createdDevVars = false;
try {
  await fs.rm(statePath, { recursive: true, force: true });
  try {
    await fs.access(devVarsPath);
  } catch {
    await fs.writeFile(devVarsPath, `ADMIN_USERNAME=${adminTestUsername}\nADMIN_PASSWORD_HASH=${adminPasswordHash}\nADMIN_SESSION_SECRET=local-admin-session-secret-for-tests-only\n`);
    createdDevVars = true;
  }
  runWrangler(["d1", "migrations", "apply", "DB", "--local", "--config", configPath, "--persist-to", statePath]);
  execute("UPDATE tenant_site_profiles SET updated_at = '2000-01-01 00:00:00' WHERE tenant_id = 'qianlin-travel' AND status = 'published'");
  execute("UPDATE tenant_hero_slides SET updated_at = '2000-01-01 00:00:00' WHERE tenant_id = 'qianlin-travel' AND status = 'published'");
  const originalProfile = query("SELECT id, tenant_id, status, created_at, updated_at, company_name_zh, company_name_en, description_zh, description_en, address_zh, address_en, logo_mark FROM tenant_site_profiles WHERE tenant_id = 'qianlin-travel' LIMIT 1")[0];
  const originalYunnanProfile = query("SELECT id, tenant_id, status, created_at, updated_at, company_name_zh, company_name_en, description_zh, description_en, address_zh, address_en, logo_mark FROM tenant_site_profiles WHERE tenant_id = 'yunnan-demo' LIMIT 1")[0] ?? null;
  const originalQianlinImageProfile = query("SELECT id, tenant_id, status, created_at, updated_at, about_image_url, about_image_alt_zh, about_image_alt_en, customize_image_url, customize_image_alt_zh, customize_image_alt_en FROM tenant_site_profiles WHERE tenant_id = 'qianlin-travel' AND status = 'published' LIMIT 1")[0];
  const originalYunnanImageProfile = query("SELECT id, tenant_id, status, created_at, updated_at, about_image_url, about_image_alt_zh, about_image_alt_en, customize_image_url, customize_image_alt_zh, customize_image_alt_en FROM tenant_site_profiles WHERE tenant_id = 'yunnan-demo' AND status = 'published' LIMIT 1")[0] ?? null;
  const originalQianlinHeroes = query("SELECT id, tenant_id, status, display_order, created_at, updated_at, image_url, alt_zh, alt_en, desktop_position, mobile_position FROM tenant_hero_slides WHERE tenant_id = 'qianlin-travel' AND status = 'published' ORDER BY display_order, id");
  const originalYunnanHeroes = query("SELECT id, tenant_id, status, display_order, created_at, updated_at, image_url, alt_zh, alt_en, desktop_position, mobile_position FROM tenant_hero_slides WHERE tenant_id = 'yunnan-demo' AND status = 'published' ORDER BY display_order, id");
  execute("UPDATE tenant_contact_channels SET value = '  qianlin-test@example.com  ' WHERE tenant_id = 'qianlin-travel' AND type = 'email' AND status = 'published'");
  const qianlinEmail = "qianlin-test@example.com";
  execute("INSERT INTO tenants (id, slug, name_zh, name_en, status, site_status, default_language, is_demo) VALUES ('configuring-test', 'configuring-test', '配置测试', 'Configuring test', 'active', 'configuring', 'zh', 0)");

  server = spawn(process.execPath, [path.join(root, "node_modules", "vinext", "dist", "cli.js"), "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: root,
    env: { ...process.env, NODE_ENV: "test", NEXT_PUBLIC_SITE_URL: baseUrl, ADMIN_USERNAME: adminTestUsername, ADMIN_PASSWORD_HASH: adminPasswordHash, ADMIN_SESSION_SECRET: adminSessionSecret, CLOUDFLARE_PERSIST_STATE_PATH: ".wrangler/http-test-state", WRANGLER_WRITE_LOGS: "false", WRANGLER_LOG_PATH: ".wrangler/http-test-logs", MINIFLARE_REGISTRY_PATH: ".wrangler/http-test-registry" },
    stdio: "ignore",
  });
  await waitForServer();

  const anonymousAdmin = await request("/admin", { redirect: "manual" });
  assert.ok([302, 303, 307, 308].includes(anonymousAdmin.response.status));
  assert.match(anonymousAdmin.response.headers.get("location") ?? "", /\/admin\/login/);
  const anonymousProfilePage = await request("/admin/profile", { redirect: "manual" });
  assert.ok([302, 303, 307, 308].includes(anonymousProfilePage.response.status));
  assert.match(anonymousProfilePage.response.headers.get("location") ?? "", /\/admin\/login/);
  const anonymousProfileSave = await request("/api/admin/profile", { method: "PUT", headers: { "content-type": "application/json", origin: baseUrl }, body: "{}" });
  assert.equal(anonymousProfileSave.response.status, 401);
  const wrongLogin = await request("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: adminTestUsername, password: "wrong-password" }) });
  assert.equal(wrongLogin.response.status, 401);
  const wrongUsername = await request("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "wrong-user", password: adminTestPassword }) });
  assert.equal(wrongUsername.response.status, 401);
  assert.deepEqual(wrongUsername.body, wrongLogin.body);
  const nonJsonLogin = await request("/api/admin/login", { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify({ username: adminTestUsername, password: adminTestPassword }) });
  assert.equal(nonJsonLogin.response.status, 415);
  const tooLargeLogin = await request("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: adminTestUsername, password: "x".repeat(9_000) }) });
  assert.equal(tooLargeLogin.response.status, 413);
  const login = await request("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: adminTestUsername, password: adminTestPassword, tenantId: "yunnan-demo" }) });
  assert.equal(login.response.status, 200);
  assert.deepEqual(login.body, { ok: true });
  assert.match(login.response.headers.get("cache-control") ?? "", /no-store/i);
  const setCookie = login.response.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.doesNotMatch(JSON.stringify(login.body), /session|token/i);
  const sessionCookie = setCookie.split(";", 1)[0];
  assert.match(sessionCookie, /^qianlin_admin_session=.+/);
  const tamperedCookie = `${sessionCookie.slice(0, -1)}${sessionCookie.endsWith("A") ? "B" : "A"}`;
  const saveProfile = (payload, options = {}) => request("/api/admin/profile", {
    method: "PUT",
    headers: { "content-type": "application/json", origin: baseUrl, cookie: options.cookie ?? sessionCookie, ...(options.headers ?? {}) },
    body: options.body ?? JSON.stringify(payload),
  });
  const saveProfileImages = (payload, options = {}) => request("/api/admin/images/profile", {
    method: "PUT",
    headers: { "content-type": "application/json", origin: baseUrl, cookie: options.cookie ?? sessionCookie, ...(options.headers ?? {}) },
    body: options.body ?? JSON.stringify(payload),
  });
  const saveHeroImages = (payload, options = {}) => request("/api/admin/images/hero", {
    method: "PUT",
    headers: { "content-type": "application/json", origin: baseUrl, cookie: options.cookie ?? sessionCookie, ...(options.headers ?? {}) },
    body: options.body ?? JSON.stringify(payload),
  });
  const validProfileImages = {
    aboutImageUrl: "/images/guizhou/about-village.png",
    aboutImageAltZh: "贵州山间村寨主题视觉图",
    aboutImageAltEn: "Guizhou mountain village travel visual",
    customizeImageUrl: "/images/guizhou/customize-mountains.png",
    customizeImageAltZh: "贵州层叠群山主题视觉图",
    customizeImageAltEn: "Layered Guizhou mountains travel visual",
  };
  const validHeroImages = {
    slides: [
      { imageUrl: "/images/hero/hero-03.webp", altZh: "贵州山水主题视觉图三", altEn: "Guizhou landscape travel visual three", desktopPosition: "left center", mobilePosition: "center top" },
      { imageUrl: "/images/guizhou/huangguoshu.png", altZh: "贵州瀑布主题视觉图", altEn: "Guizhou waterfall travel visual", desktopPosition: "right center", mobilePosition: "center bottom" },
    ],
  };
  const anonymousImagesPage = await request("/admin/images", { redirect: "manual" });
  assert.ok([302, 303, 307, 308].includes(anonymousImagesPage.response.status));
  assert.match(anonymousImagesPage.response.headers.get("location") ?? "", /\/admin\/login/);
  const anonymousProfileImages = await saveProfileImages(validProfileImages, { cookie: "" });
  assert.equal(anonymousProfileImages.response.status, 401);
  const anonymousHeroImages = await saveHeroImages(validHeroImages, { cookie: "" });
  assert.equal(anonymousHeroImages.response.status, 401);
  const imagesPage = await request("/admin/images", { headers: { cookie: sessionCookie } });
  assert.equal(imagesPage.response.status, 200);
  assert.match(imagesPage.response.headers.get("cache-control") ?? "", /no-store/i);
  assert.match(String(imagesPage.body), /<title>网站图片管理 \| 黔林旅行社<\/title>/);
  assert.match(String(imagesPage.body), /<meta[^>]+name="robots"[^>]+noindex/i);
  assert.doesNotMatch(String(imagesPage.body), /rel="canonical"|property="og:/i);
  assert.match(String(imagesPage.body), /Hero 轮播图片/);
  assert.match(String(imagesPage.body), /关于我们图片/);
  assert.match(String(imagesPage.body), /定制咨询图片/);
  const invalidImageOrigin = await saveProfileImages(validProfileImages, { headers: { origin: "https://evil.example" } });
  assert.equal(invalidImageOrigin.response.status, 403);
  const nonJsonImage = await saveProfileImages(validProfileImages, { headers: { "content-type": "text/plain" }, body: JSON.stringify(validProfileImages) });
  assert.equal(nonJsonImage.response.status, 415);
  const tooLargeImage = await saveProfileImages({ ...validProfileImages, aboutImageAltEn: "x".repeat(17_000) });
  assert.equal(tooLargeImage.response.status, 413);
  const invalidJsonImage = await saveProfileImages(validProfileImages, { body: "{" });
  assert.equal(invalidJsonImage.response.status, 400);
  const invalidPaths = ["/images/not-in-catalog.webp", "https://example.com/image.webp", "http://example.com/image.webp", "data:image/png;base64,abc", "blob:https://example.com/id", "/images/../secret.webp", "/images/guizhou/about-village.png?x=1", "/images/guizhou/about-village.png#section", "", 123];
  for (const pathValue of invalidPaths) {
    const invalidPath = await saveProfileImages({ ...validProfileImages, aboutImageUrl: pathValue });
    assert.equal(invalidPath.response.status, 400);
  }
  for (const invalidAlt of ["", "   ", "x".repeat(161), "<strong>图片</strong>"]) {
    const invalidAltResponse = await saveProfileImages({ ...validProfileImages, aboutImageAltZh: invalidAlt });
    assert.equal(invalidAltResponse.response.status, 400);
  }
  const invalidEnglishAlt = await saveProfileImages({ ...validProfileImages, aboutImageAltEn: "x".repeat(221) });
  assert.equal(invalidEnglishAlt.response.status, 400);
  const invalidPosition = await saveHeroImages({ slides: validHeroImages.slides.map((slide, index) => index === 0 ? { ...slide, desktopPosition: "top: 0;" } : slide) });
  assert.equal(invalidPosition.response.status, 400);
  const invalidCssPosition = await saveHeroImages({ slides: validHeroImages.slides.map((slide, index) => index === 0 ? { ...slide, mobilePosition: "url(javascript:alert(1))" } : slide) });
  assert.equal(invalidCssPosition.response.status, 400);
  const invalidHeroId = await saveHeroImages({ ...validHeroImages, slides: validHeroImages.slides.map((slide, index) => index === 0 ? { ...slide, id: originalQianlinHeroes[index].id } : slide) });
  assert.equal(invalidHeroId.response.status, 400);
  const invalidHeroTenant = await saveHeroImages({ ...validHeroImages, tenantId: "yunnan-demo" });
  assert.equal(invalidHeroTenant.response.status, 400);
  const invalidHeroStatus = await saveHeroImages({ ...validHeroImages, slides: validHeroImages.slides.map((slide, index) => index === 0 ? { ...slide, status: "archived" } : slide) });
  assert.equal(invalidHeroStatus.response.status, 400);
  const invalidHeroOrder = await saveHeroImages({ ...validHeroImages, slides: validHeroImages.slides.map((slide, index) => index === 0 ? { ...slide, displayOrder: 999 } : slide) });
  assert.equal(invalidHeroOrder.response.status, 400);
  for (const invalidCookie of [tamperedCookie, signedAdminCookie({ tenantId: "qianlin-travel", expiresAt: Math.floor(Date.now() / 1000) - 1 }), signedAdminCookie({ tenantId: "yunnan-demo", expiresAt: Math.floor(Date.now() / 1000) + 3600 })]) {
    assert.equal((await saveProfileImages(validProfileImages, { cookie: invalidCookie })).response.status, 401);
    assert.equal((await saveHeroImages(validHeroImages, { cookie: invalidCookie })).response.status, 401);
  }
  const savedProfileImages = await saveProfileImages({ ...validProfileImages, aboutImageAltZh: "  贵州山间村寨主题视觉图  ", aboutImageAltEn: "  Guizhou mountain village travel visual  " });
  assert.equal(savedProfileImages.response.status, 200);
  assert.match(savedProfileImages.response.headers.get("cache-control") ?? "", /no-store/i);
  assert.equal(savedProfileImages.body.profile.aboutImageAltZh, "贵州山间村寨主题视觉图");
  assert.equal(savedProfileImages.body.profile.aboutImageAltEn, "Guizhou mountain village travel visual");
  const savedHeroImages = await saveHeroImages(validHeroImages);
  assert.equal(savedHeroImages.response.status, 200);
  assert.match(savedHeroImages.response.headers.get("cache-control") ?? "", /no-store/i);
  assert.deepEqual(savedHeroImages.body.heroSlides, validHeroImages.slides);
  const profilePage = await request("/admin/profile", { headers: { cookie: sessionCookie } });
  assert.equal(profilePage.response.status, 200);
  assert.match(String(profilePage.body), /编辑公司资料/);
  assert.match(String(profilePage.body), /name="companyNameZh"/);
  const invalidOrigin = await saveProfile({}, { headers: { origin: "https://evil.example" } });
  assert.equal(invalidOrigin.response.status, 403);
  const nonJsonProfile = await saveProfile({}, { headers: { "content-type": "text/plain" }, body: "{}" });
  assert.equal(nonJsonProfile.response.status, 415);
  const tooLargeProfile = await saveProfile({ descriptionEn: "x".repeat(17_000) });
  assert.equal(tooLargeProfile.response.status, 413);
  const invalidJsonProfile = await saveProfile({}, { body: "{" });
  assert.equal(invalidJsonProfile.response.status, 400);
  const invalidProfilePayloads = [
    { companyNameZh: "" },
    { companyNameEn: "" },
    { companyNameZh: "x".repeat(101) },
    { companyNameEn: "x".repeat(161) },
    { descriptionZh: "x".repeat(1_001) },
    { descriptionEn: "x".repeat(1_501) },
    { addressZh: "x".repeat(301) },
    { addressEn: "x".repeat(501) },
    { logoMark: "" },
    { logoMark: "ABCDE" },
    { logoMark: "Q\nL" },
    { companyNameZh: 123 },
    { companyNameZh: "<script>alert(1)</script>" },
  ];
  for (const invalidPayload of invalidProfilePayloads) {
    const invalidProfile = await saveProfile({ ...invalidPayload });
    assert.equal(invalidProfile.response.status, 400);
    assert.ok(invalidProfile.body && typeof invalidProfile.body === "object" && invalidProfile.body.fieldErrors);
  }
  const validProfile = {
    companyNameZh: "  黔林旅行社  ",
    companyNameEn: " Q ",
    descriptionZh: "  用于本地集成测试的中文公司介绍。  ",
    descriptionEn: " English company description used by the local integration test. ",
    addressZh: "贵州省贵阳市测试地址",
    addressEn: "Test address, Guiyang, Guizhou",
    logoMark: " Q ",
  };
  const normalizedProfile = {
    ...validProfile,
    companyNameZh: "黔林旅行社",
    companyNameEn: "Q",
    logoMark: "Q",
  };
  const maliciousProfile = await saveProfile({ ...validProfile, tenantId: "yunnan-demo", slug: "yunnan-demo", siteStatus: "configuring", status: "archived", isDemo: true, profileId: "other-profile" });
  assert.equal(maliciousProfile.response.status, 400);
  const invalidOriginWithSession = await saveProfile(validProfile, { headers: { origin: "https://evil.example" } });
  assert.equal(invalidOriginWithSession.response.status, 403);
  const tamperedProfile = await saveProfile(validProfile, { cookie: tamperedCookie });
  assert.equal(tamperedProfile.response.status, 401);
  const expiredProfile = await saveProfile(validProfile, { cookie: signedAdminCookie({ tenantId: "qianlin-travel", expiresAt: Math.floor(Date.now() / 1000) - 1 }) });
  assert.equal(expiredProfile.response.status, 401);
  const wrongTenantProfile = await saveProfile(validProfile, { cookie: signedAdminCookie({ tenantId: "yunnan-demo", expiresAt: Math.floor(Date.now() / 1000) + 3600 }) });
  assert.equal(wrongTenantProfile.response.status, 401);
  const savedProfile = await saveProfile(validProfile);
  assert.equal(savedProfile.response.status, 200);
  assert.match(savedProfile.response.headers.get("cache-control") ?? "", /no-store/i);
  assert.deepEqual(savedProfile.body.profile, normalizedProfile);
  assert.doesNotMatch(JSON.stringify(savedProfile.body), /tenantId|tenantSlug|siteStatus|isDemo|profileId|session|token/i);
  for (const legalPath of ["/privacy", "/terms", "/refund"]) {
    const legalPage = await request(legalPath);
    assert.equal(legalPage.response.status, 200);
    assert.match(String(legalPage.body), /黔林旅行社/);
    assert.doesNotMatch(String(legalPage.body), /yunnan-demo|云南旅行社演示站/);
  }
  const privacyPage = await request("/privacy");
  assert.match(String(privacyPage.body), /贵州省贵阳市测试地址/);
  assert.ok(String(privacyPage.body).includes(qianlinEmail));
  assert.match(String(privacyPage.body), new RegExp(`mailto:${qianlinEmail.replace(".", "\\.")}`));
  assert.doesNotMatch(String(privacyPage.body), /mailto:\s/);
  const updatedProfilePage = await request("/admin/profile", { headers: { cookie: sessionCookie } });
  assert.match(String(updatedProfilePage.body), /黔林旅行社/);
  const updatedAdminPage = await request("/admin", { headers: { cookie: sessionCookie } });
  assert.match(String(updatedAdminPage.body), /黔林旅行社/);
  const tamperedSession = await request("/admin", { headers: { cookie: tamperedCookie }, redirect: "manual" });
  assert.ok([302, 303, 307, 308].includes(tamperedSession.response.status));
  const expiredSession = await request("/admin", { headers: { cookie: signedAdminCookie({ tenantId: "qianlin-travel", expiresAt: Math.floor(Date.now() / 1000) - 1 }) }, redirect: "manual" });
  assert.ok([302, 303, 307, 308].includes(expiredSession.response.status));
  const wrongTenantSession = await request("/admin", { headers: { cookie: signedAdminCookie({ tenantId: "yunnan-demo", expiresAt: Math.floor(Date.now() / 1000) + 3600 }) }, redirect: "manual" });
  assert.ok([302, 303, 307, 308].includes(wrongTenantSession.response.status));
  const adminLoginPage = await request("/admin/login");
  assert.equal(adminLoginPage.response.status, 200);
  assert.match(adminLoginPage.response.headers.get("cache-control") ?? "", /no-store/i);
  assert.match(String(adminLoginPage.body), /<title>黔林旅行社后台登录<\/title>/);
  assert.match(String(adminLoginPage.body), /<meta[^>]+name="robots"[^>]+noindex/i);
  assert.doesNotMatch(String(adminLoginPage.body), /rel="canonical"|property="og:/i);
  const adminPage = await request("/admin", { headers: { cookie: sessionCookie } });
  assert.equal(adminPage.response.status, 200);
  assert.match(adminPage.response.headers.get("cache-control") ?? "", /no-store/i);
  assert.match(String(adminPage.body), /<title>黔林旅行社管理后台<\/title>/);
  assert.match(String(adminPage.body), /qianlin-travel/);
  assert.match(String(adminPage.body), /<meta[^>]+name="robots"[^>]+noindex/i);
  assert.doesNotMatch(String(adminPage.body), /rel="canonical"|property="og:/i);
  assert.match(String(adminPage.body), /黔林旅行社/);
  assert.doesNotMatch(String(adminPage.body), /yunnan-demo|云南旅行社演示站/);
  assert.doesNotMatch(String(adminPage.body), /Local D1 functional test/);
  const logout = await request("/api/admin/logout", { method: "POST", headers: { cookie: sessionCookie } });
  assert.equal(logout.response.status, 200);
  assert.match(logout.response.headers.get("cache-control") ?? "", /no-store/i);
  assert.match(logout.response.headers.get("set-cookie") ?? "", /Max-Age=0/);
  const afterLogout = await request("/admin", { redirect: "manual" });
  assert.ok([302, 303, 307, 308].includes(afterLogout.response.status));
  const afterLogoutProfileSave = await request("/api/admin/profile", { method: "PUT", headers: { "content-type": "application/json", origin: baseUrl }, body: JSON.stringify(validProfile) });
  assert.equal(afterLogoutProfileSave.response.status, 401);

  const config = await request("/api/t/qianlin-travel/site-config");
  assert.equal(config.response.status, 200);
  assert.match(config.response.headers.get("cache-control") ?? "", /no-store/i);
  assert.equal(config.body.isConfigured, true);
  assert.equal(config.body.heroSlides.length, 2);
  assert.equal(config.body.profile.companyName.zh, normalizedProfile.companyNameZh);
  assert.equal(config.body.profile.companyName.en, normalizedProfile.companyNameEn);
  assert.equal(config.body.profile.description.zh, validProfile.descriptionZh);
  assert.equal(config.body.profile.description.en, validProfile.descriptionEn);
  assert.equal(config.body.profile.address.zh, validProfile.addressZh);
  assert.equal(config.body.profile.address.en, validProfile.addressEn);
  assert.equal(config.body.profile.logo.mark, normalizedProfile.logoMark);
  assert.match(config.body.profile.images.customize.src, /^\/images\//);

  const configuring = await request("/api/t/configuring-test/site-config");
  assert.equal(configuring.response.status, 200);
  assert.equal(configuring.body.isConfigured, false);
  assert.deepEqual(configuring.body.contacts, []);
  assert.deepEqual(configuring.body.heroSlides, []);
  assert.equal(configuring.body.profile.description.zh, "");

  const yunnanOptions = await request("/api/t/yunnan-demo/planner/options");
  assert.equal(yunnanOptions.response.status, 200);
  assert.equal(yunnanOptions.body.destinations.length, 0);
  const sitemap = await request("/sitemap.xml");
  assert.equal(sitemap.response.status, 200);
  assert.doesNotMatch(String(sitemap.body), /yunnan-demo|configuring-test/);
  const configuringPage = await request("/t/configuring-test");
  assert.equal(configuringPage.response.status, 200);
  assert.match(String(configuringPage.body), /noindex/i);

  const demoInquiry = await request("/api/t/yunnan-demo/inquiries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(validPayload) });
  assert.equal(demoInquiry.response.status, 403);
  const configuringInquiry = await request("/api/t/configuring-test/inquiries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(validPayload) });
  assert.equal(configuringInquiry.response.status, 403);
  const unknownInquiry = await request("/api/t/missing-tenant/inquiries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(validPayload) });
  assert.equal(unknownInquiry.response.status, 404);
  const oldInquiry = await request("/api/inquiries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(validPayload) });
  assert.equal(oldInquiry.response.status, 404);

  const nonJson = await request("/api/t/qianlin-travel/inquiries", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" });
  assert.equal(nonJson.response.status, 415);
  const tooLarge = await request("/api/t/qianlin-travel/inquiries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...validPayload, message: "x".repeat(33_000) }) });
  assert.equal(tooLarge.response.status, 413);
  const honeypot = await request("/api/t/qianlin-travel/inquiries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...validPayload, website: "filled" }) });
  assert.equal(honeypot.response.status, 400);
  const privacy = await request("/api/t/qianlin-travel/inquiries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...validPayload, privacyConsent: false }) });
  assert.equal(privacy.response.status, 400);
  const invalidPhone = await request("/api/t/qianlin-travel/inquiries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...validPayload, phone: "12345678901" }) });
  assert.equal(invalidPhone.response.status, 400);

  const accepted = await request("/api/t/qianlin-travel/inquiries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(validPayload) });
  assert.equal(accepted.response.status, 201);
  const duplicate = await request("/api/t/qianlin-travel/inquiries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(validPayload) });
  assert.equal(duplicate.response.status, 409);
  const differentName = await request("/api/t/qianlin-travel/inquiries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...validPayload, name: "Different name" }) });
  assert.equal(differentName.response.status, 201);
  const storedImageProfile = query("SELECT id, tenant_id, status, created_at, updated_at, about_image_url, about_image_alt_zh, about_image_alt_en, customize_image_url, customize_image_alt_zh, customize_image_alt_en FROM tenant_site_profiles WHERE tenant_id = 'qianlin-travel' AND status = 'published' LIMIT 1")[0];
  assert.equal(storedImageProfile.id, originalQianlinImageProfile.id);
  assert.equal(storedImageProfile.tenant_id, originalQianlinImageProfile.tenant_id);
  assert.equal(storedImageProfile.status, originalQianlinImageProfile.status);
  assert.equal(storedImageProfile.created_at, originalQianlinImageProfile.created_at);
  assert.notEqual(storedImageProfile.updated_at, originalQianlinImageProfile.updated_at);
  assert.equal(storedImageProfile.about_image_url, validProfileImages.aboutImageUrl);
  assert.equal(storedImageProfile.customize_image_url, validProfileImages.customizeImageUrl);
  const storedHeroes = query("SELECT id, tenant_id, status, display_order, created_at, updated_at, image_url, alt_zh, alt_en, desktop_position, mobile_position FROM tenant_hero_slides WHERE tenant_id = 'qianlin-travel' AND status = 'published' ORDER BY display_order, id");
  assert.equal(storedHeroes.length, 2);
  for (let index = 0; index < storedHeroes.length; index += 1) {
    assert.equal(storedHeroes[index].id, originalQianlinHeroes[index].id);
    assert.equal(storedHeroes[index].tenant_id, originalQianlinHeroes[index].tenant_id);
    assert.equal(storedHeroes[index].status, originalQianlinHeroes[index].status);
    assert.equal(storedHeroes[index].display_order, originalQianlinHeroes[index].display_order);
    assert.equal(storedHeroes[index].created_at, originalQianlinHeroes[index].created_at);
    assert.notEqual(storedHeroes[index].updated_at, originalQianlinHeroes[index].updated_at);
    assert.deepEqual({ imageUrl: storedHeroes[index].image_url, altZh: storedHeroes[index].alt_zh, altEn: storedHeroes[index].alt_en, desktopPosition: storedHeroes[index].desktop_position, mobilePosition: storedHeroes[index].mobile_position }, validHeroImages.slides[index]);
  }
  const afterImageYunnanProfile = query("SELECT id, tenant_id, status, created_at, updated_at, about_image_url, about_image_alt_zh, about_image_alt_en, customize_image_url, customize_image_alt_zh, customize_image_alt_en FROM tenant_site_profiles WHERE tenant_id = 'yunnan-demo' AND status = 'published' LIMIT 1")[0] ?? null;
  const afterImageYunnanHeroes = query("SELECT id, tenant_id, status, display_order, created_at, updated_at, image_url, alt_zh, alt_en, desktop_position, mobile_position FROM tenant_hero_slides WHERE tenant_id = 'yunnan-demo' AND status = 'published' ORDER BY display_order, id");
  assert.deepEqual(afterImageYunnanProfile, originalYunnanImageProfile);
  assert.deepEqual(afterImageYunnanHeroes, originalYunnanHeroes);
  const storedProfile = query("SELECT id, tenant_id, status, created_at, updated_at, company_name_zh, company_name_en, description_zh, description_en, address_zh, address_en, logo_mark FROM tenant_site_profiles WHERE tenant_id = 'qianlin-travel' LIMIT 1")[0];
  assert.equal(storedProfile.id, originalProfile.id);
  assert.equal(storedProfile.tenant_id, "qianlin-travel");
  assert.equal(storedProfile.status, originalProfile.status);
  assert.equal(storedProfile.created_at, originalProfile.created_at);
  assert.notEqual(storedProfile.updated_at, originalProfile.updated_at);
  assert.equal(storedProfile.company_name_zh, normalizedProfile.companyNameZh);
  assert.equal(storedProfile.company_name_en, normalizedProfile.companyNameEn);
  assert.equal(storedProfile.description_zh, validProfile.descriptionZh);
  assert.equal(storedProfile.description_en, validProfile.descriptionEn);
  assert.equal(storedProfile.address_zh, validProfile.addressZh);
  assert.equal(storedProfile.address_en, validProfile.addressEn);
  assert.equal(storedProfile.logo_mark, normalizedProfile.logoMark);
  const afterMaliciousYunnanProfile = query("SELECT id, tenant_id, status, created_at, updated_at, company_name_zh, company_name_en, description_zh, description_en, address_zh, address_en, logo_mark FROM tenant_site_profiles WHERE tenant_id = 'yunnan-demo' LIMIT 1")[0] ?? null;
  assert.deepEqual(afterMaliciousYunnanProfile, originalYunnanProfile);
  const stored = query("SELECT tenant_id, phone, message FROM inquiries ORDER BY id DESC LIMIT 1")[0];
  assert.equal(stored.tenant_id, "qianlin-travel");
  assert.equal(stored.phone, "18985127882");
  assert.equal(stored.message, "Local D1 functional test");
  console.log("Local HTTP functional tests passed: tenant guards, safe config, inquiry validation, tenant binding, and duplicate protection.");
} finally {
  if (server && !server.killed) {
    if (process.platform === "win32") {
      try { execFileSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" }); } catch {}
    } else server.kill("SIGTERM");
  }
  await fs.rm(statePath, { recursive: true, force: true });
  if (createdDevVars) await fs.rm(devVarsPath, { force: true });
}
