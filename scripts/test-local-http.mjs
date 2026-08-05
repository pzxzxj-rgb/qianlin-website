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

  const config = await request("/api/t/qianlin-travel/site-config");
  assert.equal(config.response.status, 200);
  assert.equal(config.body.isConfigured, true);
  assert.equal(config.body.heroSlides.length, 2);
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
