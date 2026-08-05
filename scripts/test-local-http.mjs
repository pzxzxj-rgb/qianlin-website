import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const statePath = path.resolve(root, ".wrangler", "http-test-state");
const configPath = path.resolve(root, "wrangler.local.jsonc");
const port = 8790;
const baseUrl = `http://127.0.0.1:${port}`;

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
try {
  await fs.rm(statePath, { recursive: true, force: true });
  runWrangler(["d1", "migrations", "apply", "DB", "--local", "--config", configPath, "--persist-to", statePath]);
  execute("INSERT INTO tenants (id, slug, name_zh, name_en, status, site_status, default_language, is_demo) VALUES ('configuring-test', 'configuring-test', '配置测试', 'Configuring test', 'active', 'configuring', 'zh', 0)");

  server = spawn(process.execPath, [path.join(root, "node_modules", "vinext", "dist", "cli.js"), "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: root,
    env: { ...process.env, NEXT_PUBLIC_SITE_URL: baseUrl, CLOUDFLARE_PERSIST_STATE_PATH: ".wrangler/http-test-state", WRANGLER_WRITE_LOGS: "false", WRANGLER_LOG_PATH: ".wrangler/http-test-logs", MINIFLARE_REGISTRY_PATH: ".wrangler/http-test-registry" },
    stdio: "ignore",
  });
  await waitForServer();

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
}
