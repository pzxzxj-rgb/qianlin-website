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
  let response;
  try {
    response = await fetch(`${baseUrl}${pathname}`, { ...init, headers: { connection: "close", ...(init?.headers ?? {}) } });
  } catch (error) {
    throw new Error(`HTTP request failed for ${pathname}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
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
  execute("INSERT OR IGNORE INTO tenant_contact_channels (id, tenant_id, type, label_zh, label_en, value, href, display_order, status) VALUES ('yunnan-contact-test', 'yunnan-demo', 'phone', '测试电话', 'Test phone', '13900001234', 'tel:+8613900001234', 10, 'published')");
  const originalYunnanContacts = query("SELECT id, tenant_id, type, label_zh, label_en, value, href, display_order, status, created_at, updated_at FROM tenant_contact_channels WHERE tenant_id = 'yunnan-demo' ORDER BY display_order, id");
  execute("INSERT OR IGNORE INTO tenant_tours (id, tenant_id, slug, title_zh, title_en, description_zh, description_en, duration_zh, duration_en, tag_zh, tag_en, price_text_zh, price_text_en, image_url, image_alt_zh, image_alt_en, featured, display_order, status) VALUES ('yunnan-tour-test', 'yunnan-demo', 'fictional-shared-route', '云南虚构线路', 'Fictional Yunnan route', '云南租户测试线路介绍。', 'A fictional Yunnan tour for tenant isolation tests.', '', '', '测试', 'Test', '', '', '', '', '', 1, 5, 'published')");
  const originalYunnanTours = query("SELECT id, tenant_id, slug, title_zh, title_en, description_zh, description_en, duration_zh, duration_en, tag_zh, tag_en, price_text_zh, price_text_en, image_url, image_alt_zh, image_alt_en, featured, display_order, status, created_at, updated_at FROM tenant_tours WHERE tenant_id = 'yunnan-demo' ORDER BY display_order, id");
  const originalQianlinDestinationIdentities = query("SELECT id, tenant_id FROM planner_destinations WHERE tenant_id = 'qianlin-travel' ORDER BY id");
  execute("INSERT OR IGNORE INTO planner_destinations (id, tenant_id, province_code, slug, city_code, name_zh, name_en, description_zh, description_en, image_url, card_size, region_zh, region_en, route_order, overnight_zh, overnight_en, recommended_visit_hours, major_attraction, available_for_planning, show_on_homepage, display_order, status) VALUES ('yunnan-destination-test', 'yunnan-demo', 'guizhou', 'fictional-shared-destination', 'yunnan-test-city', '云南虚构目的地', 'Fictional Yunnan destination', '云南租户虚构目的地介绍。', 'A fictional Yunnan destination for tenant isolation tests.', '/images/guizhou/hero-guizhou.png', 'small', '云南虚构区域', 'Fictional Yunnan region', 5, '', '', 3, 1, 1, 1, 5, 'published')");
  const originalYunnanDestinations = query("SELECT id, tenant_id, province_code, slug, city_code, name_zh, name_en, description_zh, description_en, image_url, card_size, region_zh, region_en, route_order, overnight_zh, overnight_en, recommended_visit_hours, major_attraction, available_for_planning, show_on_homepage, display_order, status, created_at, updated_at FROM planner_destinations WHERE tenant_id = 'yunnan-demo' ORDER BY display_order, id");
  execute("UPDATE tenant_contact_channels SET value = '  qianlin-test@example.com  ', href = 'mailto:qianlin-test@example.com' WHERE tenant_id = 'qianlin-travel' AND type = 'email' AND status = 'published'");
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
  const anonymousContactsPage = await request("/admin/contacts", { redirect: "manual" });
  assert.ok([302, 303, 307, 308].includes(anonymousContactsPage.response.status));
  assert.match(anonymousContactsPage.response.headers.get("location") ?? "", /\/admin\/login/);
  const anonymousToursPage = await request("/admin/tours", { redirect: "manual" });
  assert.ok([302, 303, 307, 308].includes(anonymousToursPage.response.status));
  assert.match(anonymousToursPage.response.headers.get("location") ?? "", /\/admin\/login/);
  const anonymousDestinationsPage = await request("/admin/destinations", { redirect: "manual" });
  assert.ok([302, 303, 307, 308].includes(anonymousDestinationsPage.response.status));
  assert.match(anonymousDestinationsPage.response.headers.get("location") ?? "", /\/admin\/login/);
  const anonymousProfileSave = await request("/api/admin/profile", { method: "PUT", headers: { "content-type": "application/json", origin: baseUrl }, body: "{}" });
  assert.equal(anonymousProfileSave.response.status, 401);
  const anonymousContactsRead = await request("/api/admin/contacts");
  assert.equal(anonymousContactsRead.response.status, 401);
  const anonymousContactsSave = await request("/api/admin/contacts", { method: "PUT", headers: { "content-type": "application/json", origin: baseUrl }, body: "{}" });
  assert.equal(anonymousContactsSave.response.status, 401);
  const anonymousToursRead = await request("/api/admin/tours");
  assert.equal(anonymousToursRead.response.status, 401);
  const anonymousToursCreate = await request("/api/admin/tours", { method: "POST", headers: { "content-type": "application/json", origin: baseUrl }, body: "{}" });
  assert.equal(anonymousToursCreate.response.status, 401);
  const anonymousToursUpdate = await request("/api/admin/tours/missing-tour", { method: "PUT", headers: { "content-type": "application/json", origin: baseUrl }, body: "{}" });
  assert.equal(anonymousToursUpdate.response.status, 401);
  const anonymousDestinationsRead = await request("/api/admin/destinations");
  assert.equal(anonymousDestinationsRead.response.status, 401);
  const anonymousDestinationsCreate = await request("/api/admin/destinations", { method: "POST", headers: { "content-type": "application/json", origin: baseUrl }, body: "{}" });
  assert.equal(anonymousDestinationsCreate.response.status, 401);
  const anonymousDestinationsUpdate = await request("/api/admin/destinations/missing-destination", { method: "PUT", headers: { "content-type": "application/json", origin: baseUrl }, body: "{}" });
  assert.equal(anonymousDestinationsUpdate.response.status, 401);
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
  const getContacts = (options = {}) => request("/api/admin/contacts", {
    headers: { cookie: options.cookie ?? sessionCookie, ...(options.headers ?? {}) },
  });
  const saveContacts = (payload, options = {}) => request("/api/admin/contacts", {
    method: "PUT",
    headers: { "content-type": "application/json", origin: baseUrl, cookie: options.cookie ?? sessionCookie, ...(options.headers ?? {}) },
    body: options.body ?? JSON.stringify(payload),
  });
  const getTours = (options = {}) => request("/api/admin/tours", {
    headers: { cookie: options.cookie ?? sessionCookie, ...(options.headers ?? {}) },
  });
  const createTour = (payload, options = {}) => request("/api/admin/tours", {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseUrl, cookie: options.cookie ?? sessionCookie, ...(options.headers ?? {}) },
    body: options.body ?? JSON.stringify(payload),
  });
  const updateTour = (tourId, payload, options = {}) => request(`/api/admin/tours/${encodeURIComponent(tourId)}`, {
    method: "PUT",
    headers: { "content-type": "application/json", origin: baseUrl, cookie: options.cookie ?? sessionCookie, ...(options.headers ?? {}) },
    body: options.body ?? JSON.stringify(payload),
  });
  const getDestinations = (options = {}) => request("/api/admin/destinations", {
    headers: { cookie: options.cookie ?? sessionCookie, ...(options.headers ?? {}) },
  });
  const createDestination = (payload, options = {}) => request("/api/admin/destinations", {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseUrl, cookie: options.cookie ?? sessionCookie, ...(options.headers ?? {}) },
    body: options.body ?? JSON.stringify(payload),
  });
  const updateDestination = (destinationId, payload, options = {}) => request(`/api/admin/destinations/${encodeURIComponent(destinationId)}`, {
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
  const contactsPage = await request("/admin/contacts", { headers: { cookie: sessionCookie } });
  assert.equal(contactsPage.response.status, 200);
  assert.match(contactsPage.response.headers.get("cache-control") ?? "", /no-store/i);
  assert.match(String(contactsPage.body), /<title>联系方式管理 \| 黔林旅行社<\/title>/);
  assert.match(String(contactsPage.body), /<meta[^>]+name="robots"[^>]+noindex/i);
  assert.doesNotMatch(String(contactsPage.body), /rel="canonical"|property="og:/i);
  assert.match(String(contactsPage.body), /中文显示名称/);
  assert.match(String(contactsPage.body), /英文显示名称/);
  assert.match(String(contactsPage.body), /跳转链接/);
  assert.match(String(contactsPage.body), /联系方式已加载/);
  const toursPage = await request("/admin/tours", { headers: { cookie: sessionCookie } });
  assert.equal(toursPage.response.status, 200);
  assert.match(toursPage.response.headers.get("cache-control") ?? "", /no-store/i);
  assert.match(String(toursPage.body), /<title>旅游线路管理 \| 黔林旅行社<\/title>/);
  assert.match(String(toursPage.body), /<meta[^>]+name="robots"[^>]+noindex/i);
  assert.doesNotMatch(String(toursPage.body), /rel="canonical"|property="og:/i);
  assert.match(String(toursPage.body), /新增线路/);
  assert.match(String(toursPage.body), /已有线路/);
  assert.match(String(toursPage.body), /线路数据已加载/);
  assert.doesNotMatch(String(toursPage.body), /yunnan-demo|云南虚构线路/);
  const destinationsPage = await request("/admin/destinations", { headers: { cookie: sessionCookie } });
  assert.equal(destinationsPage.response.status, 200);
  assert.match(destinationsPage.response.headers.get("cache-control") ?? "", /no-store/i);
  assert.match(String(destinationsPage.body), /<title>目的地管理 \| 黔林旅行社<\/title>/);
  assert.match(String(destinationsPage.body), /<meta[^>]+name="robots"[^>]+noindex/i);
  assert.doesNotMatch(String(destinationsPage.body), /rel="canonical"|property="og:/i);
  assert.match(String(destinationsPage.body), /新增目的地/);
  assert.match(String(destinationsPage.body), /已有目的地/);
  assert.match(String(destinationsPage.body), /状态筛选/);
  assert.match(String(destinationsPage.body), /黄果树瀑布/);
  assert.doesNotMatch(String(destinationsPage.body), /yunnan-demo|云南虚构目的地/);
  const toursRead = await getTours();
  assert.equal(toursRead.response.status, 200);
  assert.match(toursRead.response.headers.get("cache-control") ?? "", /no-store/i);
  assert.deepEqual(toursRead.body.tours, []);
  assert.doesNotMatch(JSON.stringify(toursRead.body), /tenantId|tenant_id|tenantSlug|ownerId|organizationId|isDemo|createdBy|session|token|password/i);
  const invalidToursOrigin = await createTour({}, { headers: { origin: "https://evil.example" } });
  assert.equal(invalidToursOrigin.response.status, 403);
  const nonJsonTours = await createTour({}, { headers: { "content-type": "text/plain" }, body: "{}" });
  assert.equal(nonJsonTours.response.status, 415);
  const tooLargeTours = await createTour({ descriptionEn: "x".repeat(60_000) });
  assert.equal(tooLargeTours.response.status, 413);
  const invalidJsonTours = await createTour({}, { body: "{" });
  assert.equal(invalidJsonTours.response.status, 400);
  const destinationsRead = await getDestinations();
  assert.equal(destinationsRead.response.status, 200);
  assert.match(destinationsRead.response.headers.get("cache-control") ?? "", /no-store/i);
  assert.equal(destinationsRead.body.destinations.length, 16);
  assert.ok(destinationsRead.body.cityOptions.some((city) => city.code === "guiyang"));
  assert.ok(destinationsRead.body.cityOptions.every((city) => !Object.hasOwn(city, "tenantId") && !Object.hasOwn(city, "tenant_id")));
  assert.doesNotMatch(JSON.stringify(destinationsRead.body), /yunnan-demo|云南虚构目的地|tenantId|tenant_id|tenantSlug|ownerId|organizationId|isDemo|createdBy|createdAt|updatedAt/i);
  const invalidDestinationsOrigin = await createDestination({}, { headers: { origin: "https://evil.example" } });
  assert.equal(invalidDestinationsOrigin.response.status, 403);
  const nonJsonDestinations = await createDestination({}, { headers: { "content-type": "text/plain" }, body: "{}" });
  assert.equal(nonJsonDestinations.response.status, 415);
  const tooLargeDestinations = await createDestination({ descriptionEn: "x".repeat(70_000) });
  assert.equal(tooLargeDestinations.response.status, 413);
  const invalidJsonDestinations = await createDestination({}, { body: "{" });
  assert.equal(invalidJsonDestinations.response.status, 400);

  const validDestination = {
    slug: "fictional-destination-route",
    cityCode: "guiyang",
    nameZh: "虚构贵州目的地",
    nameEn: "Fictional Guizhou Destination",
    descriptionZh: "用于本地集成测试的虚构贵州目的地介绍。",
    descriptionEn: "A fictional Guizhou destination for local integration testing.",
    imageUrl: "/images/guizhou/hero-guizhou.png",
    cardSize: "large",
    regionZh: "虚构贵州区域",
    regionEn: "Fictional Guizhou region",
    routeOrder: 5,
    overnightZh: "贵阳",
    overnightEn: "Guiyang",
    recommendedVisitHours: 4,
    majorAttraction: true,
    availableForPlanning: true,
    showOnHomepage: true,
    displayOrder: 0,
    status: "draft",
  };
  const createdDestinationResponse = await createDestination(validDestination);
  assert.equal(createdDestinationResponse.response.status, 201);
  assert.match(createdDestinationResponse.response.headers.get("cache-control") ?? "", /no-store/i);
  assert.ok(createdDestinationResponse.body.destination?.id);
  assert.doesNotMatch(JSON.stringify(createdDestinationResponse.body), /tenantId|tenant_id|tenantSlug|ownerId|organizationId|isDemo|createdBy|provinceCode|province_code|createdAt|updatedAt|session|token|password/i);
  const createdDestination = createdDestinationResponse.body.destination;
  const createdDestinationRow = query("SELECT id, tenant_id, province_code, city_code, created_at, updated_at FROM planner_destinations WHERE id = '" + createdDestination.id + "' AND tenant_id = 'qianlin-travel'")[0];
  assert.equal(createdDestinationRow.tenant_id, "qianlin-travel");
  assert.equal(createdDestinationRow.province_code, "guizhou");
  assert.equal(createdDestinationRow.city_code, "guiyang");
  assert.ok(createdDestinationRow.created_at);
  const duplicateDestinationSlug = await createDestination({ ...validDestination, nameZh: "重复 slug 测试目的地" });
  assert.equal(duplicateDestinationSlug.response.status, 409);
  assert.doesNotMatch(JSON.stringify(duplicateDestinationSlug.body), /yunnan-demo|planner_destinations|SQL|UNIQUE/i);

  const invalidDestinationPayloads = [
    { slug: "ab" },
    { slug: "Bad Slug" },
    { slug: "bad/slug" },
    { slug: "bad\\slug" },
    { slug: "bad..slug" },
    { slug: "bad%2fslug" },
    { slug: "-bad-slug" },
    { slug: "bad-slug-" },
    { slug: "x".repeat(81) },
    { nameZh: "" },
    { nameZh: "   " },
    { nameEn: "" },
    { descriptionZh: "" },
    { descriptionEn: "   " },
    { descriptionZh: "x".repeat(1_001) },
    { descriptionEn: "x".repeat(1_501) },
    { nameZh: "<script>alert(1)</script>" },
    { descriptionEn: "<strong>unsafe</strong>" },
    { cityCode: "not-a-real-city" },
    { imageUrl: "https://example.invalid/destination.webp" },
    { imageUrl: "http://example.invalid/destination.webp" },
    { imageUrl: "data:image/png;base64,blocked" },
    { imageUrl: "blob:https://example.invalid/id" },
    { imageUrl: "javascript:alert(1)" },
    { imageUrl: "/images/hero/hero-06.webp" },
    { imageUrl: "/images/guizhou/../secret.png" },
    { imageUrl: "/images/guizhou/hero-guizhou.png?x=1" },
    { imageUrl: "/images/guizhou/hero-guizhou.png#part" },
    { imageUrl: "/images/guizhou\\hero-guizhou.png" },
    { cardSize: "medium" },
    { regionZh: "" },
    { routeOrder: -1 },
    { routeOrder: 1001 },
    { routeOrder: 1.5 },
    { routeOrder: "1" },
    { displayOrder: -1 },
    { displayOrder: 1001 },
    { displayOrder: 1.5 },
    { displayOrder: "1" },
    { overnightZh: "贵阳", overnightEn: "" },
    { overnightZh: "", overnightEn: "Guiyang" },
    { recommendedVisitHours: 0 },
    { recommendedVisitHours: 49 },
    { recommendedVisitHours: 1.5 },
    { recommendedVisitHours: "4" },
    { majorAttraction: "true" },
    { availableForPlanning: 1 },
    { showOnHomepage: "false" },
    { status: "pending" },
    { showOnHomepage: true, imageUrl: "" },
  ];
  for (const [index, changes] of invalidDestinationPayloads.entries()) {
    const invalidDestination = await createDestination({ ...validDestination, ...changes, slug: changes.slug ?? `invalid-destination-${index}` });
    assert.equal(invalidDestination.response.status, 400, `invalid destination case ${index}`);
    assert.ok(invalidDestination.body && typeof invalidDestination.body === "object" && invalidDestination.body.fieldErrors);
  }
  const residualFailure = await createDestination({ ...validDestination, slug: "residual-city-destination", cityCode: "yunnan-test-city" });
  assert.equal(residualFailure.response.status, 400);
  assert.equal(query("SELECT COUNT(*) AS count FROM planner_destinations WHERE tenant_id = 'qianlin-travel' AND slug = 'residual-city-destination'")[0].count, 0);
  for (const dangerousField of ["id", "tenantId", "tenant_id", "tenantSlug", "ownerId", "organizationId", "isDemo", "createdBy", "provinceCode", "province_code", "createdAt", "updatedAt"]) {
    const dangerousDestination = await createDestination({ ...validDestination, slug: `dangerous-destination-${dangerousField.toLowerCase()}`, [dangerousField]: dangerousField === "id" ? "client-destination-id" : "yunnan-demo" });
    assert.equal(dangerousDestination.response.status, 400);
  }
  const unknownDestinationField = await createDestination({ ...validDestination, slug: "unknown-destination-field", unexpected: "rejected" });
  assert.equal(unknownDestinationField.response.status, 400);
  assert.equal(query("SELECT COUNT(*) AS count FROM planner_destinations WHERE tenant_id = 'qianlin-travel' AND slug IN ('unknown-destination-field', 'dangerous-destination-tenantid')")[0].count, 0);

  const toDestinationPayload = (row) => ({
    slug: row.slug,
    cityCode: row.city_code ?? "",
    nameZh: row.name_zh,
    nameEn: row.name_en,
    descriptionZh: row.description_zh,
    descriptionEn: row.description_en,
    imageUrl: row.image_url,
    cardSize: row.card_size,
    regionZh: row.region_zh,
    regionEn: row.region_en,
    routeOrder: row.route_order,
    overnightZh: row.overnight_zh,
    overnightEn: row.overnight_en,
    recommendedVisitHours: row.recommended_visit_hours,
    majorAttraction: Boolean(row.major_attraction),
    availableForPlanning: Boolean(row.available_for_planning),
    showOnHomepage: Boolean(row.show_on_homepage),
    displayOrder: row.display_order,
    status: row.status,
  });
  execute("UPDATE planner_destinations SET updated_at = '2000-01-01 00:00:00' WHERE id = 'huangguoshu-waterfall' AND tenant_id = 'qianlin-travel'");
  const existingDestinationBefore = query("SELECT id, tenant_id, province_code, slug, city_code, name_zh, name_en, description_zh, description_en, image_url, card_size, region_zh, region_en, route_order, overnight_zh, overnight_en, recommended_visit_hours, major_attraction, available_for_planning, show_on_homepage, display_order, status, created_at, updated_at FROM planner_destinations WHERE id = 'huangguoshu-waterfall' AND tenant_id = 'qianlin-travel'")[0];
  const existingDestinationPayload = { ...toDestinationPayload(existingDestinationBefore), nameZh: "更新后的虚构黄果树目的地", nameEn: "Updated fictional Huangguoshu destination", majorAttraction: false, availableForPlanning: true, showOnHomepage: false, cardSize: "small", routeOrder: 42, displayOrder: 7, overnightZh: "安顺", overnightEn: "Anshun", recommendedVisitHours: 5, status: "published" };
  const updatedExistingDestination = await updateDestination("huangguoshu-waterfall", existingDestinationPayload);
  assert.equal(updatedExistingDestination.response.status, 200);
  assert.equal(updatedExistingDestination.body.destination.nameZh, "更新后的虚构黄果树目的地");
  assert.doesNotMatch(JSON.stringify(updatedExistingDestination.body), /tenantId|tenant_id|tenantSlug|ownerId|organizationId|isDemo|createdBy|provinceCode|province_code|createdAt|updatedAt|session|token|password/i);
  const updatedExistingRow = query("SELECT id, tenant_id, province_code, created_at, updated_at, name_zh, display_order FROM planner_destinations WHERE id = 'huangguoshu-waterfall' AND tenant_id = 'qianlin-travel'")[0];
  assert.equal(updatedExistingRow.id, existingDestinationBefore.id);
  assert.equal(updatedExistingRow.tenant_id, "qianlin-travel");
  assert.equal(updatedExistingRow.province_code, "guizhou");
  assert.equal(updatedExistingRow.created_at, existingDestinationBefore.created_at);
  assert.notEqual(updatedExistingRow.updated_at, "2000-01-01 00:00:00");
  assert.equal(updatedExistingRow.name_zh, "更新后的虚构黄果树目的地");
  assert.equal(updatedExistingRow.display_order, 7);
  const createdDestinationUpdated = await updateDestination(createdDestination.id, { ...validDestination, nameZh: "发布后的虚构贵州目的地", status: "published", displayOrder: 1, routeOrder: 6, availableForPlanning: false, showOnHomepage: true });
  assert.equal(createdDestinationUpdated.response.status, 200);
  const createdBeforeConflict = query("SELECT id, tenant_id, slug, name_zh, city_code, status FROM planner_destinations WHERE id = '" + createdDestination.id + "' AND tenant_id = 'qianlin-travel'")[0];
  const duplicateDestinationUpdate = await updateDestination(createdDestination.id, { ...validDestination, slug: "huangguoshu-waterfall", nameZh: "不应写入的重复目的地" });
  assert.equal(duplicateDestinationUpdate.response.status, 409);
  assert.deepEqual(query("SELECT id, tenant_id, slug, name_zh, city_code, status FROM planner_destinations WHERE id = '" + createdDestination.id + "' AND tenant_id = 'qianlin-travel'")[0], createdBeforeConflict);
  const invalidDestinationUpdate = await updateDestination(createdDestination.id, { ...validDestination, cityCode: "yunnan-test-city" });
  assert.equal(invalidDestinationUpdate.response.status, 400);
  assert.deepEqual(query("SELECT id, tenant_id, slug, name_zh, city_code, status FROM planner_destinations WHERE id = '" + createdDestination.id + "' AND tenant_id = 'qianlin-travel'")[0], createdBeforeConflict);
  const publishedDestinationPayload = { ...validDestination, nameZh: "发布后的虚构贵州目的地", status: "published", displayOrder: 1, routeOrder: 6, availableForPlanning: true, showOnHomepage: true };
  const archivedDestination = await updateDestination(createdDestination.id, { ...publishedDestinationPayload, status: "archived" });
  assert.equal(archivedDestination.response.status, 200);
  const restoredDestination = await updateDestination(createdDestination.id, publishedDestinationPayload);
  assert.equal(restoredDestination.response.status, 200);
  const crossTenantDestination = await updateDestination("yunnan-destination-test", { ...validDestination, slug: "fictional-shared-destination" });
  const missingDestination = await updateDestination("missing-destination-id", validDestination);
  assert.equal(crossTenantDestination.response.status, 404);
  assert.equal(missingDestination.response.status, 404);
  assert.deepEqual(crossTenantDestination.body, missingDestination.body);
  assert.doesNotMatch(JSON.stringify(crossTenantDestination.body), /yunnan-demo|yunnan-destination-test|planner_destinations|SQL/i);
  assert.deepEqual(query("SELECT id, tenant_id, province_code, slug, city_code, name_zh, name_en, description_zh, description_en, image_url, card_size, region_zh, region_en, route_order, overnight_zh, overnight_en, recommended_visit_hours, major_attraction, available_for_planning, show_on_homepage, display_order, status, created_at, updated_at FROM planner_destinations WHERE tenant_id = 'yunnan-demo' ORDER BY display_order, id"), originalYunnanDestinations);
  const destinationReadAfterSave = await getDestinations();
  assert.equal(destinationReadAfterSave.response.status, 200);
  assert.equal(destinationReadAfterSave.body.destinations.length, 17);
  assert.ok(destinationReadAfterSave.body.destinations.some((destination) => destination.id === createdDestination.id && destination.status === "published"));
  assert.ok(destinationReadAfterSave.body.destinations.every((destination) => !Object.hasOwn(destination, "tenantId") && !Object.hasOwn(destination, "tenant_id") && !Object.hasOwn(destination, "provinceCode") && !Object.hasOwn(destination, "createdAt") && !Object.hasOwn(destination, "updatedAt")));
  const draftDestination = await createDestination({ ...validDestination, slug: "draft-fictional-destination", nameZh: "草稿虚构目的地", status: "draft", imageUrl: "", showOnHomepage: false });
  const archivedDestinationForPublic = await createDestination({ ...validDestination, slug: "archived-fictional-destination", nameZh: "归档虚构目的地", status: "archived", showOnHomepage: false });
  assert.equal(draftDestination.response.status, 201);
  assert.equal(archivedDestinationForPublic.response.status, 201);

  const validTour = {
    slug: "fictional-guizhou-5-days",
    titleZh: "虚构贵州五日线路",
    titleEn: "Fictional Guizhou Five-Day Route",
    descriptionZh: "用于本地集成测试的虚构线路介绍。",
    descriptionEn: "A fictional route description for local integration testing.",
    durationZh: "5天4晚",
    durationEn: "5 Days 4 Nights",
    tagZh: "测试线路",
    tagEn: "Test route",
    priceTextZh: "价格请咨询",
    priceTextEn: "Contact us for price",
    imageUrl: "/images/guizhou/huangguoshu.png",
    imageAltZh: "虚构线路图片",
    imageAltEn: "Fictional route image",
    featured: true,
    displayOrder: 10,
    status: "published",
  };
  const createdTourResponse = await createTour(validTour);
  assert.equal(createdTourResponse.response.status, 200);
  assert.match(createdTourResponse.response.headers.get("cache-control") ?? "", /no-store/i);
  assert.ok(createdTourResponse.body.tour?.id);
  assert.doesNotMatch(JSON.stringify(createdTourResponse.body), /tenantId|tenant_id|tenantSlug|ownerId|organizationId|isDemo|createdBy|session|token|password/i);
  const createdTour = createdTourResponse.body.tour;
  const createdTourRow = query("SELECT id, tenant_id, created_at, updated_at FROM tenant_tours WHERE id = '" + createdTour.id + "' AND tenant_id = 'qianlin-travel'")[0];
  assert.equal(createdTourRow.tenant_id, "qianlin-travel");
  execute("UPDATE tenant_tours SET created_at = '2000-01-01 00:00:00', updated_at = '2000-01-01 00:00:00' WHERE id = '" + createdTour.id + "' AND tenant_id = 'qianlin-travel'");
  const duplicateSlug = await createTour({ ...validTour, titleZh: "重复 slug 测试线路" });
  assert.equal(duplicateSlug.response.status, 409);
  assert.doesNotMatch(JSON.stringify(duplicateSlug.body), /yunnan-demo|tenant_tours|SQL|UNIQUE/i);

  const invalidTourPayloads = [
    { slug: "ab" },
    { slug: "Bad Slug" },
    { slug: "bad/slug" },
    { slug: "bad..slug" },
    { slug: "bad%2fslug" },
    { slug: "x".repeat(81) },
    { titleZh: "" },
    { titleZh: "   " },
    { titleEn: "" },
    { descriptionZh: "x".repeat(1_001) },
    { descriptionEn: "x".repeat(1_501) },
    { titleZh: "<script>alert(1)</script>" },
    { descriptionEn: "<strong>unsafe</strong>" },
    { imageUrl: "/images/not-in-catalog.webp" },
    { imageUrl: "https://example.invalid/tour.webp" },
    { imageUrl: "http://example.invalid/tour.webp" },
    { imageUrl: "data:image/png;base64,blocked" },
    { imageUrl: "blob:https://example.invalid/id" },
    { imageUrl: "javascript:alert(1)" },
    { imageUrl: "/images/hero/hero-06.webp" },
    { imageUrl: "/images/guizhou/../secret.png" },
    { imageUrl: "/images/guizhou/huangguoshu.png?x=1" },
    { imageUrl: "/images/guizhou/huangguoshu.png#part" },
    { imageUrl: "/images/guizhou\\huangguoshu.png" },
    { imageUrl: validTour.imageUrl, imageAltZh: "", imageAltEn: "" },
    { featured: "true" },
    { featured: 1 },
    { displayOrder: -1 },
    { displayOrder: 1001 },
    { displayOrder: 1.5 },
    { status: "pending" },
  ];
  for (const changes of invalidTourPayloads) {
    const invalidTour = await createTour({ ...validTour, ...changes, slug: changes.slug ?? `invalid-${Math.random().toString(36).slice(2, 10)}` });
    assert.equal(invalidTour.response.status, 400);
    assert.ok(invalidTour.body && typeof invalidTour.body === "object" && invalidTour.body.fieldErrors);
  }
  const unknownTourField = await createTour({ ...validTour, slug: "unknown-field-tour", unexpected: "rejected" });
  assert.equal(unknownTourField.response.status, 400);
  for (const dangerousField of ["tenantId", "tenant_id", "tenantSlug", "ownerId", "organizationId", "isDemo", "createdBy", "id"]) {
    const dangerousTour = await createTour({ ...validTour, slug: `dangerous-${dangerousField.toLowerCase()}`, [dangerousField]: dangerousField === "id" ? "client-tour-id" : "yunnan-demo" });
    assert.equal(dangerousTour.response.status, 400);
  }
  const updatedTourResponse = await updateTour(createdTour.id, { ...validTour, titleZh: "更新后的虚构贵州五日线路", displayOrder: 1 });
  assert.equal(updatedTourResponse.response.status, 200);
  assert.equal(updatedTourResponse.body.tour.titleZh, "更新后的虚构贵州五日线路");
  assert.doesNotMatch(JSON.stringify(updatedTourResponse.body), /tenantId|tenant_id|tenantSlug|ownerId|organizationId|isDemo|createdBy|session|token|password/i);
  const updatedTourRow = query("SELECT id, tenant_id, created_at, updated_at, title_zh, display_order FROM tenant_tours WHERE id = '" + createdTour.id + "' AND tenant_id = 'qianlin-travel'")[0];
  assert.equal(updatedTourRow.created_at, "2000-01-01 00:00:00");
  assert.notEqual(updatedTourRow.updated_at, "2000-01-01 00:00:00");
  assert.equal(updatedTourRow.title_zh, "更新后的虚构贵州五日线路");
  assert.equal(updatedTourRow.display_order, 1);
  const secondTourResponse = await createTour({ ...validTour, slug: "fictional-second-route", titleZh: "第二条虚构线路", titleEn: "Second fictional route", displayOrder: 2 });
  assert.equal(secondTourResponse.response.status, 200);
  const secondTour = secondTourResponse.body.tour;
  const secondBeforeConflict = query("SELECT id, tenant_id, slug, title_zh, status FROM tenant_tours WHERE id = '" + secondTour.id + "' AND tenant_id = 'qianlin-travel'")[0];
  const duplicateUpdate = await updateTour(secondTour.id, { ...validTour, slug: updatedTourResponse.body.tour.slug, titleZh: "不应写入的重复线路" });
  assert.equal(duplicateUpdate.response.status, 409);
  assert.deepEqual(query("SELECT id, tenant_id, slug, title_zh, status FROM tenant_tours WHERE id = '" + secondTour.id + "' AND tenant_id = 'qianlin-travel'")[0], secondBeforeConflict);
  const invalidUpdate = await updateTour(createdTour.id, { ...validTour, titleZh: "" });
  assert.equal(invalidUpdate.response.status, 400);
  assert.equal(query("SELECT title_zh FROM tenant_tours WHERE id = '" + createdTour.id + "' AND tenant_id = 'qianlin-travel'")[0].title_zh, "更新后的虚构贵州五日线路");
  const crossTenantUpdate = await updateTour("yunnan-tour-test", { ...validTour, slug: "fictional-shared-route" });
  const missingTourUpdate = await updateTour("missing-tour-id", validTour);
  assert.equal(crossTenantUpdate.response.status, 404);
  assert.equal(missingTourUpdate.response.status, 404);
  assert.deepEqual(crossTenantUpdate.body, missingTourUpdate.body);
  assert.doesNotMatch(JSON.stringify(crossTenantUpdate.body), /yunnan-demo|yunnan-tour-test|tenant_tours/i);
  assert.deepEqual(query("SELECT id, tenant_id, slug, title_zh, title_en, description_zh, description_en, duration_zh, duration_en, tag_zh, tag_en, price_text_zh, price_text_en, image_url, image_alt_zh, image_alt_en, featured, display_order, status, created_at, updated_at FROM tenant_tours WHERE tenant_id = 'yunnan-demo' ORDER BY display_order, id"), originalYunnanTours);

  const additionalTours = [
    { ...validTour, slug: "draft-fictional-route", titleZh: "草稿虚构线路", titleEn: "Draft fictional route", featured: true, displayOrder: 3, status: "draft" },
    { ...validTour, slug: "archived-fictional-route", titleZh: "归档虚构线路", titleEn: "Archived fictional route", featured: true, displayOrder: 4, status: "archived" },
    { ...validTour, slug: "nonfeatured-fictional-route", titleZh: "非推荐虚构线路", titleEn: "Non-featured fictional route", featured: false, displayOrder: 5, status: "published" },
    ...Array.from({ length: 6 }, (_, index) => ({ ...validTour, slug: `featured-fictional-route-${index + 1}`, titleZh: `推荐虚构线路 ${index + 1}`, titleEn: `Featured fictional route ${index + 1}`, displayOrder: 20 + index, status: "published" })),
  ];
  for (const additionalTour of additionalTours) {
    const response = await createTour(additionalTour);
    assert.equal(response.response.status, 200);
  }
  const qianlinToursAfterCreate = await getTours();
  assert.equal(qianlinToursAfterCreate.response.status, 200);
  assert.equal(qianlinToursAfterCreate.body.tours.length, 11);
  assert.ok(qianlinToursAfterCreate.body.tours.every((tour) => !Object.hasOwn(tour, "tenantId") && !Object.hasOwn(tour, "tenant_id")));

  const currentQianlinContacts = query("SELECT id, tenant_id, type, label_zh, label_en, value, href, display_order, status FROM tenant_contact_channels WHERE tenant_id = 'qianlin-travel' ORDER BY display_order, id").map((row) => ({ id: row.id, type: row.type, labelZh: row.label_zh, labelEn: row.label_en, value: row.value, href: row.href ?? "", displayOrder: row.display_order, status: row.status }));
  const validContacts = { channels: currentQianlinContacts };
  const contactsRead = await getContacts();
  assert.equal(contactsRead.response.status, 200);
  assert.match(contactsRead.response.headers.get("cache-control") ?? "", /no-store/i);
  assert.deepEqual(contactsRead.body.contacts, currentQianlinContacts);
  assert.doesNotMatch(JSON.stringify(contactsRead.body), /tenantId|tenant_id|tenantSlug|ownerId|isDemo|session|token|password/i);

  const invalidContactsOrigin = await saveContacts(validContacts, { headers: { origin: "https://evil.example" } });
  assert.equal(invalidContactsOrigin.response.status, 403);
  const nonJsonContacts = await saveContacts(validContacts, { headers: { "content-type": "text/plain" }, body: JSON.stringify(validContacts) });
  assert.equal(nonJsonContacts.response.status, 415);
  const tooLargeContacts = await saveContacts({ channels: currentQianlinContacts.map((contact, index) => index === 0 ? { ...contact, labelEn: "x".repeat(30_000) } : contact) });
  assert.equal(tooLargeContacts.response.status, 413);
  const invalidJsonContacts = await saveContacts(validContacts, { body: "{" });
  assert.equal(invalidJsonContacts.response.status, 400);

  const contactWith = (index, changes) => ({ channels: currentQianlinContacts.map((contact, contactIndex) => contactIndex === index ? { ...contact, ...changes } : { ...contact }) });
  const phoneIndex = currentQianlinContacts.findIndex((contact) => contact.type === "phone");
  const wechatIndex = currentQianlinContacts.findIndex((contact) => contact.type === "wechat");
  const emailIndex = currentQianlinContacts.findIndex((contact) => contact.type === "email");
  assert.ok(phoneIndex >= 0 && wechatIndex >= 0 && emailIndex >= 0);
  const phoneSaved = await saveContacts(contactWith(phoneIndex, { value: "13800001234", href: "" }));
  assert.equal(phoneSaved.response.status, 200);
  assert.equal(phoneSaved.body.contacts[phoneIndex].value, "13800001234");
  assert.equal(phoneSaved.body.contacts[phoneIndex].href, "tel:+8613800001234");
  const wechatSaved = await saveContacts({ channels: phoneSaved.body.contacts.map((contact, index) => index === wechatIndex ? { ...contact, value: "qianlin-test-3d", href: "" } : contact) });
  assert.equal(wechatSaved.response.status, 200);
  assert.equal(wechatSaved.body.contacts[wechatIndex].value, "qianlin-test-3d");
  assert.equal(wechatSaved.body.contacts[wechatIndex].href, "");
  const emailSaved = await saveContacts({ channels: wechatSaved.body.contacts.map((contact, index) => index === emailIndex ? { ...contact, value: "contact-test@example.invalid", href: "" } : contact) });
  assert.equal(emailSaved.response.status, 200);
  assert.equal(emailSaved.body.contacts[emailIndex].value, "contact-test@example.invalid");
  assert.equal(emailSaved.body.contacts[emailIndex].href, "mailto:contact-test@example.invalid");
  assert.doesNotMatch(JSON.stringify(emailSaved.body), /tenantId|tenant_id|tenantSlug|ownerId|isDemo|session|token|password/i);
  const metadataSaved = await saveContacts({ channels: emailSaved.body.contacts.map((contact) => contact.id === emailSaved.body.contacts[phoneIndex].id ? { ...contact, labelZh: "咨询电话", labelEn: "Travel phone", displayOrder: 15 } : contact) });
  assert.equal(metadataSaved.response.status, 200);
  assert.equal(metadataSaved.body.contacts.find((contact) => contact.id === emailSaved.body.contacts[phoneIndex].id)?.labelZh, "咨询电话");
  assert.equal(metadataSaved.body.contacts.find((contact) => contact.id === emailSaved.body.contacts[phoneIndex].id)?.displayOrder, 15);
  const drafted = await saveContacts({ channels: metadataSaved.body.contacts.map((contact) => contact.id === emailSaved.body.contacts[phoneIndex].id ? { ...contact, status: "draft" } : contact) });
  assert.equal(drafted.response.status, 200);
  assert.equal(drafted.body.contacts.find((contact) => contact.id === emailSaved.body.contacts[phoneIndex].id)?.status, "draft");
  const restored = await saveContacts({ channels: drafted.body.contacts.map((contact) => contact.id === emailSaved.body.contacts[phoneIndex].id ? { ...contact, status: "published" } : contact) });
  assert.equal(restored.response.status, 200);
  const updatedContactPayload = { channels: restored.body.contacts };
  const contactsWith = (contacts, index, changes) => contacts.map((contact, contactIndex) => contactIndex === index ? { ...contact, ...changes } : { ...contact });
  const phoneMismatch = await saveContacts({ channels: contactsWith(phoneSaved.body.contacts, phoneIndex, { href: "tel:+8613900001234" }) });
  assert.ok([400, 409].includes(phoneMismatch.response.status));
  const emailMismatch = await saveContacts({ channels: contactsWith(emailSaved.body.contacts, emailIndex, { href: "mailto:other@example.invalid" }) });
  assert.ok([400, 409].includes(emailMismatch.response.status));
  const changedType = await saveContacts({ channels: contactsWith(updatedContactPayload.channels, phoneIndex, { type: "email", value: "type-change@example.invalid", href: "" }) });
  assert.ok([400, 409].includes(changedType.response.status));
  const duplicatePhone = await saveContacts({ channels: contactsWith(updatedContactPayload.channels, wechatIndex, { type: "phone", value: "13800001234", href: "" }) });
  assert.ok([400, 409].includes(duplicatePhone.response.status));
  assert.deepEqual((await getContacts()).body.contacts, updatedContactPayload.channels);

  for (const invalidPayload of [
    contactWith(phoneIndex, { value: "" }),
    contactWith(phoneIndex, { value: "   " }),
    contactWith(phoneIndex, { value: "12345678901" }),
    contactWith(phoneIndex, { value: "x".repeat(33) }),
    contactWith(phoneIndex, { value: "13800001234", labelZh: "<script>alert(1)</script>" }),
    contactWith(phoneIndex, { value: "13800001234", labelEn: "x".repeat(101) }),
    contactWith(emailIndex, { value: "invalid-email" }),
    contactWith(emailIndex, { value: "contact-test@example.invalid", href: "javascript:alert(1)" }),
    contactWith(emailIndex, { value: "contact-test@example.invalid", href: "data:text/html,blocked" }),
    contactWith(emailIndex, { value: "contact-test@example.invalid", href: "blob:https://example.invalid/id" }),
    contactWith(emailIndex, { value: "contact-test@example.invalid", href: "https://example.invalid/../secret" }),
    contactWith(emailIndex, { value: "contact-test@example.invalid", href: "mailto:contact-test@example.invalid%00" }),
    contactWith(emailIndex, { value: "contact-test@example.invalid", href: "mailto:contact-test@example.invalid%1f" }),
    contactWith(emailIndex, { value: "contact-test@example.invalid", href: "mailto:contact-test@example.invalid%7f" }),
    contactWith(emailIndex, { value: "contact-test@example.invalid", href: "mailto:contact-test@example.invalid%0d" }),
    contactWith(emailIndex, { value: "contact-test@example.invalid", href: "mailto:contact-test@example.invalid%0a" }),
    contactWith(emailIndex, { value: "contact-test@example.invalid", href: "mailto:contact-test@example.invalid%250a" }),
    contactWith(phoneIndex, { value: "13800001234", displayOrder: -1 }),
    contactWith(phoneIndex, { value: "13800001234", displayOrder: 1001 }),
    contactWith(phoneIndex, { value: "13800001234", displayOrder: 1.5 }),
    contactWith(phoneIndex, { value: "13800001234", status: "pending" }),
    contactWith(phoneIndex, { value: "13800001234", type: "whatsapp" }),
  ]) {
    const invalidResponse = await saveContacts(invalidPayload);
    assert.equal(invalidResponse.response.status, 400);
    assert.ok(invalidResponse.body && typeof invalidResponse.body === "object" && invalidResponse.body.fieldErrors);
  }

  for (const dangerousField of ["tenantId", "tenant_id", "tenantSlug", "ownerId", "isDemo"]) {
    const dangerousResponse = await saveContacts({ ...updatedContactPayload, [dangerousField]: "yunnan-demo" });
    assert.equal(dangerousResponse.response.status, 400);
  }
  const unknownContactField = await saveContacts({ channels: updatedContactPayload.channels.map((contact) => ({ ...contact, unexpected: "rejected" })) });
  assert.equal(unknownContactField.response.status, 400);
  const crossTenantContact = await saveContacts({ channels: updatedContactPayload.channels.map((contact, index) => index === 0 ? { ...contact, id: "yunnan-contact-test" } : contact) });
  assert.equal(crossTenantContact.response.status, 409);
  assert.doesNotMatch(JSON.stringify(crossTenantContact.body), /yunnan-demo|yunnan-contact-test|tenant/i);
  assert.deepEqual(query("SELECT id, tenant_id, type, label_zh, label_en, value, href, display_order, status, created_at, updated_at FROM tenant_contact_channels WHERE tenant_id = 'yunnan-demo' ORDER BY display_order, id"), originalYunnanContacts);
  assert.deepEqual(query("SELECT id, tenant_id, type, label_zh, label_en, value, href, display_order, status FROM tenant_contact_channels WHERE tenant_id = 'qianlin-travel' ORDER BY display_order, id"), updatedContactPayload.channels.map((contact) => ({ id: contact.id, tenant_id: "qianlin-travel", type: contact.type, label_zh: contact.labelZh, label_en: contact.labelEn, value: contact.value, href: contact.href || null, display_order: contact.displayOrder, status: contact.status })));

  for (const invalidCookie of [tamperedCookie, signedAdminCookie({ tenantId: "qianlin-travel", expiresAt: Math.floor(Date.now() / 1000) - 1 }), signedAdminCookie({ tenantId: "yunnan-demo", expiresAt: Math.floor(Date.now() / 1000) + 3600 })]) {
    assert.equal((await getContacts({ cookie: invalidCookie })).response.status, 401);
    assert.equal((await saveContacts(updatedContactPayload, { cookie: invalidCookie })).response.status, 401);
    assert.equal((await getTours({ cookie: invalidCookie })).response.status, 401);
    assert.equal((await createTour(validTour, { cookie: invalidCookie })).response.status, 401);
    assert.equal((await updateTour(createdTour.id, validTour, { cookie: invalidCookie })).response.status, 401);
    assert.equal((await getDestinations({ cookie: invalidCookie })).response.status, 401);
    assert.equal((await createDestination(validDestination, { cookie: invalidCookie })).response.status, 401);
    assert.equal((await updateDestination(createdDestination.id, validDestination, { cookie: invalidCookie })).response.status, 401);
  }
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
  const afterLogoutContactsSave = await request("/api/admin/contacts", { method: "PUT", headers: { "content-type": "application/json", origin: baseUrl }, body: JSON.stringify(updatedContactPayload) });
  assert.equal(afterLogoutContactsSave.response.status, 401);
  const afterLogoutToursRead = await request("/api/admin/tours");
  assert.equal(afterLogoutToursRead.response.status, 401);
  const afterLogoutToursCreate = await request("/api/admin/tours", { method: "POST", headers: { "content-type": "application/json", origin: baseUrl }, body: JSON.stringify(validTour) });
  assert.equal(afterLogoutToursCreate.response.status, 401);
  const afterLogoutToursUpdate = await request(`/api/admin/tours/${encodeURIComponent(createdTour.id)}`, { method: "PUT", headers: { "content-type": "application/json", origin: baseUrl }, body: JSON.stringify(validTour) });
  assert.equal(afterLogoutToursUpdate.response.status, 401);
  const afterLogoutDestinationsRead = await request("/api/admin/destinations");
  assert.equal(afterLogoutDestinationsRead.response.status, 401);
  const afterLogoutDestinationsCreate = await request("/api/admin/destinations", { method: "POST", headers: { "content-type": "application/json", origin: baseUrl }, body: JSON.stringify(validDestination) });
  assert.equal(afterLogoutDestinationsCreate.response.status, 401);
  const afterLogoutDestinationsUpdate = await request(`/api/admin/destinations/${encodeURIComponent(createdDestination.id)}`, { method: "PUT", headers: { "content-type": "application/json", origin: baseUrl }, body: JSON.stringify(validDestination) });
  assert.equal(afterLogoutDestinationsUpdate.response.status, 401);

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
  assert.equal(config.body.tours.length, 9);
  assert.ok(config.body.tours.every((tour) => tour.status === "published"));
  assert.ok(config.body.tours.every((tour) => !Object.hasOwn(tour, "tenant_id") && !Object.hasOwn(tour, "createdAt") && !Object.hasOwn(tour, "updatedAt")));
  assert.match(JSON.stringify(config.body.tours), /fictional-guizhou-5-days/);
  assert.doesNotMatch(JSON.stringify(config.body.tours), /draft-fictional-route|archived-fictional-route|yunnan-demo|yunnan-tour-test/);
  assert.equal(config.body.contacts.find((contact) => contact.type === "phone")?.value, "13800001234");
  assert.equal(config.body.contacts.find((contact) => contact.type === "wechat")?.value, "qianlin-test-3d");
  assert.equal(config.body.contacts.find((contact) => contact.type === "email")?.value, "contact-test@example.invalid");
  assert.equal(config.body.contacts.find((contact) => contact.type === "email")?.href, "mailto:contact-test@example.invalid");
  const qianlinOptions = await request("/api/t/qianlin-travel/planner/options");
  assert.equal(qianlinOptions.response.status, 200);
  assert.match(qianlinOptions.response.headers.get("cache-control") ?? "", /no-store/i);
  assert.ok(qianlinOptions.body.destinations.some((destination) => destination.slug === "fictional-destination-route"));
  assert.doesNotMatch(JSON.stringify(qianlinOptions.body), /draft-fictional-destination|archived-fictional-destination|yunnan-destination-test|云南虚构目的地/);
  assert.ok(qianlinOptions.body.destinations.every((destination) => !Object.hasOwn(destination, "createdAt") && !Object.hasOwn(destination, "updatedAt") && !Object.hasOwn(destination, "tenant_id")));
  for (let index = 1; index < qianlinOptions.body.destinations.length; index += 1) {
    const previous = qianlinOptions.body.destinations[index - 1];
    const current = qianlinOptions.body.destinations[index];
    assert.ok(previous.routeOrder < current.routeOrder || (previous.routeOrder === current.routeOrder && (previous.displayOrder < current.displayOrder || (previous.displayOrder === current.displayOrder && previous.id <= current.id))));
  }
  const publicHome = await request("/");
  assert.equal(publicHome.response.status, 200);
  assert.match(String(publicHome.body), /13800001234/);
  assert.match(String(publicHome.body), /contact-test@example\.invalid/);
  assert.match(String(publicHome.body), /更新后的虚构贵州五日线路/);
  assert.match(String(publicHome.body), /Featured fictional route 1/);
  assert.equal((String(publicHome.body).match(/<article class="tour-card">/g) ?? []).length, 6);
  const yunnanConfig = await request("/api/t/yunnan-demo/site-config");
  assert.equal(yunnanConfig.response.status, 200);
  assert.ok(yunnanConfig.body.tours.every((tour) => tour.tenantId === "yunnan-demo"));
  assert.doesNotMatch(JSON.stringify(config.body), /yunnan-tour-test|fictional-shared-route/);

  const configuring = await request("/api/t/configuring-test/site-config");
  assert.equal(configuring.response.status, 200);
  assert.equal(configuring.body.isConfigured, false);
  assert.deepEqual(configuring.body.contacts, []);
  assert.deepEqual(configuring.body.heroSlides, []);
  assert.equal(configuring.body.profile.description.zh, "");

  const yunnanOptions = await request("/api/t/yunnan-demo/planner/options");
  assert.equal(yunnanOptions.response.status, 200);
  assert.equal(yunnanOptions.body.destinations.length, 1);
  assert.equal(yunnanOptions.body.destinations[0].id, "yunnan-destination-test");
  assert.doesNotMatch(JSON.stringify(qianlinOptions.body), /yunnan-destination-test|fictional-shared-destination/);
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
  const afterYunnanTours = query("SELECT id, tenant_id, slug, title_zh, title_en, description_zh, description_en, duration_zh, duration_en, tag_zh, tag_en, price_text_zh, price_text_en, image_url, image_alt_zh, image_alt_en, featured, display_order, status, created_at, updated_at FROM tenant_tours WHERE tenant_id = 'yunnan-demo' ORDER BY display_order, id");
  assert.deepEqual(afterYunnanTours, originalYunnanTours);
  const afterYunnanDestinations = query("SELECT id, tenant_id, province_code, slug, city_code, name_zh, name_en, description_zh, description_en, image_url, card_size, region_zh, region_en, route_order, overnight_zh, overnight_en, recommended_visit_hours, major_attraction, available_for_planning, show_on_homepage, display_order, status, created_at, updated_at FROM planner_destinations WHERE tenant_id = 'yunnan-demo' ORDER BY display_order, id");
  assert.deepEqual(afterYunnanDestinations, originalYunnanDestinations);
  const afterQianlinDestinationIdentities = query("SELECT id, tenant_id FROM planner_destinations WHERE tenant_id = 'qianlin-travel' ORDER BY id");
  for (const originalDestination of originalQianlinDestinationIdentities) assert.ok(afterQianlinDestinationIdentities.some((destination) => destination.id === originalDestination.id && destination.tenant_id === originalDestination.tenant_id));
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
