import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { pbkdf2Sync, randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const configPath = path.resolve(root, "wrangler.local.jsonc");
// Each scenario gets its own state directory: the previous scenario's async
// cleanup removes its path ~500ms after the dev server exits, so sharing one
// path would race with the next scenario's migrations/INSERTs/workerd boot.
let statePath;
let logsPath;
let registryPath;
function freshPaths(label) {
  statePath = path.resolve(root, ".wrangler", `sync-http-test-${Date.now()}-${process.pid}-${label}`);
  logsPath = path.join(statePath, "logs");
  registryPath = path.join(statePath, "registry");
}
const devVarsPath = path.resolve(root, ".dev.vars");
const username = "sync-owner-test";
const password = "SyncTestPassword!123";
const passwordHash = `pbkdf2-sha256$600000$${Buffer.from("sync-owner-test-salt").toString("base64url")}$${pbkdf2Sync(password, Buffer.from("sync-owner-test-salt"), 600000, 32, "sha256").toString("base64url")}`;
const REQUEST_TIMEOUT_MS = 30_000;

function runWrangler(args) { return execFileSync(process.execPath, [wrangler, ...args], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
function query(sql) { return JSON.parse(runWrangler(["d1", "execute", "DB", "--local", "--config", configPath, "--persist-to", statePath, "--json", "--command", sql]))[0]?.results ?? []; }
function execute(sql) { runWrangler(["d1", "execute", "DB", "--local", "--config", configPath, "--persist-to", statePath, "--command", sql]); }
async function freePort() { return new Promise((resolve, reject) => { const server = createServer(); server.once("error", reject); server.listen(0, "127.0.0.1", () => { const address = server.address(); server.close(() => resolve(typeof address === "object" && address ? address.port : 0)); }); }); }
async function fetchWithin(url, timeoutMs, init = {}) { const controller = new AbortController(); let timeout; const pending = fetch(url, { ...init, signal: controller.signal }); const expiration = new Promise((_, reject) => { timeout = setTimeout(() => { controller.abort(); reject(new Error(`request timed out after ${timeoutMs}ms`)); }, timeoutMs); }); try { return await Promise.race([pending, expiration]); } finally { clearTimeout(timeout); void pending.catch(() => undefined); } }
async function request(baseUrl, pathname, init) { const response = await fetchWithin(`${baseUrl}${pathname}`, REQUEST_TIMEOUT_MS, { ...init, headers: { connection: "close", ...(init?.headers ?? {}) } }); const text = await response.text(); let body; try { body = JSON.parse(text); } catch { body = text; } return { response, body }; }
function scheduleCleanup(target) { const script = "const fs=require('fs');const p=process.argv[1];let n=0;const f=()=>{try{fs.rmSync(p,{recursive:true,force:true});}catch(e){if(++n<60)setTimeout(f,500);}};setTimeout(f,500);"; try { spawn(process.execPath, ["-e", script, target], { detached: true, stdio: "ignore", windowsHide: true }).unref(); } catch {} }
async function removeTempPath(target) { scheduleCleanup(target); }

async function runScenario({ failure }) {
  freshPaths(failure ? "failure" : "success");
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const readinessToken = randomBytes(18).toString("base64url");
  const output = [];
  let server;
  try {
    console.log(`sync HTTP scenario start: ${failure ? "failure" : "success"}`);
    runWrangler(["d1", "migrations", "apply", "DB", "--local", "--config", configPath, "--persist-to", statePath]);
    execute(`INSERT OR IGNORE INTO users (id, username, password_hash, display_name_zh, display_name_en, status) VALUES ('sync-owner-user', '${username}', '${passwordHash}', '同步测试管理员', 'Sync test owner', 'active')`);
    execute("INSERT OR IGNORE INTO tenant_memberships (id, tenant_id, user_id, role, status) VALUES ('sync-owner-membership', 'qianlin-travel', 'sync-owner-user', 'owner', 'active')");
    execute(`INSERT OR IGNORE INTO users (id, username, password_hash, display_name_zh, display_name_en, status) VALUES ('sync-editor-user', 'sync-editor-test', '${passwordHash}', '同步测试编辑', 'Sync test editor', 'active')`);
    execute("INSERT OR IGNORE INTO tenant_memberships (id, tenant_id, user_id, role, status) VALUES ('sync-editor-membership', 'qianlin-travel', 'sync-editor-user', 'editor', 'active')");
    execute("INSERT OR IGNORE INTO inquiries (tenant_id, submission_id, name, phone, travelers, privacy_consent, message, email, status) VALUES ('yunnan-demo', 'sync-other-tenant-submission', 'Other Tenant', '17700000002', '1', 1, 'other-tenant-test', 'other@example.invalid', 'new')");
    const yunnanInquiryId = query("SELECT id FROM inquiries WHERE tenant_id = 'yunnan-demo' ORDER BY id DESC LIMIT 1")[0].id;
    execute(`INSERT OR IGNORE INTO tenant_inquiry_sync_jobs (id, tenant_id, inquiry_id, provider, status, idempotency_key) VALUES ('yunnan-sync-job', 'yunnan-demo', ${yunnanInquiryId}, 'mock', 'pending', 'yunnan-demo:inquiry:${yunnanInquiryId}:provider:mock')`);
    await fs.writeFile(devVarsPath, `APP_ENV=test\nADMIN_USERNAME=${username}\nADMIN_PASSWORD_HASH=${passwordHash}\nADMIN_TENANT_ID=qianlin-travel\nHTTP_TEST_READINESS_TOKEN=${readinessToken}\nERP_PROVIDER=mock\nERP_MOCK_FAILURE=${failure ? "true" : "false"}\n`);
    server = spawn(process.execPath, [path.join(root, "node_modules", "vinext", "dist", "cli.js"), "dev", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: root, env: { ...process.env, APP_ENV: "test", ERP_PROVIDER: "mock", ERP_MOCK_FAILURE: failure ? "true" : "false", ADMIN_USERNAME: username, ADMIN_PASSWORD_HASH: passwordHash, ADMIN_TENANT_ID: "qianlin-travel", NEXT_PUBLIC_SITE_URL: baseUrl, HTTP_TEST_READINESS_TOKEN: readinessToken, CLOUDFLARE_PERSIST_STATE_PATH: statePath, WRANGLER_WRITE_LOGS: "false", WRANGLER_LOG_PATH: logsPath, MINIFLARE_REGISTRY_PATH: registryPath }, stdio: ["ignore", "pipe", "pipe"] });
    server.stdout.on("data", (chunk) => output.push(String(chunk)));
    server.stderr.on("data", (chunk) => output.push(String(chunk)));
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (server.exitCode !== null) throw new Error(`sync test server exited: ${output.join("").slice(-3000)}`);
      try { const ready = await fetchWithin(`${baseUrl}/api/t/qianlin-travel/site-config`, 1_000); if (ready.status === 200 && ready.headers.get("x-qianlin-readiness") === readinessToken) break; } catch {}
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (attempt === 59) throw new Error(`sync test server did not become ready within 90s: ${output.join("").slice(-3000)}`);
    }
    console.log(`sync HTTP scenario ready: ${failure ? "failure" : "success"}`);

    const login = await request(baseUrl, "/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) });
    assert.equal(login.response.status, 200);
    const ownerCookie = (login.response.headers.get("set-cookie") ?? "").split(";", 1)[0];
    const payload = { submissionId: randomUUID(), name: failure ? "Mock failure inquiry" : "Mock success inquiry", phone: failure ? "17700000003" : "17700000004", wechat: "", email: "", location: "贵阳", travelDate: "", travelers: "1", duration: "", tourName: "", places: "", message: failure ? "failure-only-test" : "success-only-test", privacyConsent: true, turnstileToken: "" };
    const submitted = await request(baseUrl, "/api/t/qianlin-travel/inquiries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    assert.equal(submitted.response.status, 201);
    assert.equal(submitted.body.sync.status, "pending");
    assert.equal(submitted.body.sync.provider, "mock");
    console.log(`sync HTTP submission queued: ${failure ? "failure" : "success"}`);
    const inquiryId = submitted.body.inquiry.id;
    const beforeRetry = query(`SELECT tenant_id, phone, message FROM inquiries WHERE id = ${inquiryId}`)[0];
    assert.equal(beforeRetry.tenant_id, "qianlin-travel");
    assert.equal(query(`SELECT status, external_record_id FROM tenant_inquiry_sync_jobs WHERE tenant_id = 'qianlin-travel' AND inquiry_id = ${inquiryId} AND provider = 'mock'`)[0].status, "pending");
    execute(`UPDATE tenant_inquiry_sync_jobs SET status = 'processing', updated_at = datetime('now', '-20 minutes'), last_attempt_at = datetime('now', '-20 minutes') WHERE tenant_id = 'qianlin-travel' AND inquiry_id = ${inquiryId} AND provider = 'mock'`);
    const viewerRetry = await request(baseUrl, `/api/admin/t/qianlin-travel/inquiries/${inquiryId}/sync`, { method: "POST", headers: { origin: baseUrl, cookie: ownerCookie, "content-type": "application/json" }, body: JSON.stringify({ tenantId: "yunnan-demo" }) });
    assert.equal(viewerRetry.response.status, 400);
    const retry = await request(baseUrl, `/api/admin/t/qianlin-travel/inquiries/${inquiryId}/sync`, { method: "POST", headers: { origin: baseUrl, cookie: ownerCookie } });
    assert.equal(retry.response.status, 200);
    console.log(`sync HTTP retry returned: ${failure ? "failure" : "success"}`);
    assert.equal(retry.body.sync.provider, "mock");
    assert.equal(retry.body.sync.status, failure ? "failed" : "synced");
    if (failure) assert.equal(retry.body.sync.errorCode, "MOCK_PROVIDER_FAILURE");
    else assert.match(retry.body.sync.externalRecordId, /^mock-/);
    assert.deepEqual(query(`SELECT tenant_id, phone, message FROM inquiries WHERE id = ${inquiryId}`)[0], beforeRetry);
    assert.doesNotMatch(JSON.stringify(retry.body), /1770000000|failure-only-test|success-only-test|The mock ERP provider was configured to fail/);
    const crossTenantRetry = await request(baseUrl, `/api/admin/t/qianlin-travel/inquiries/${yunnanInquiryId}/sync`, { method: "POST", headers: { origin: baseUrl, cookie: ownerCookie } });
    assert.equal(crossTenantRetry.response.status, 404);
    if (failure) {
      // API responses for dead-letter jobs must expose only a whitelisted error
      // code and generic message; the raw provider error is deliberately seeded
      // with fake PII-like text to prove it cannot leak through list/detail APIs.
      const rawProviderError = "raw-provider-response fake-phone-17700000003 fake-token-do-not-expose";
      execute(`UPDATE tenant_inquiry_sync_jobs SET status = 'dead_letter', external_record_id = 'must-not-leak', last_error_code = 'MOCK_PROVIDER_FAILURE', last_error_message = '${rawProviderError}', retry_count = 5 WHERE tenant_id = 'qianlin-travel' AND inquiry_id = ${inquiryId} AND provider = 'mock'`);
      execute("UPDATE tenant_inquiry_sync_jobs SET status = 'dead_letter', last_error_code = 'ERP_PROVIDER_ERROR', last_error_message = 'other-tenant-raw-error' WHERE id = 'yunnan-sync-job'");

      const list = await request(baseUrl, "/api/admin/t/qianlin-travel/inquiries?page=1&pageSize=50", { headers: { cookie: ownerCookie } });
      assert.equal(list.response.status, 200);
      const listItem = list.body.items.find((item) => item.id === inquiryId);
      assert.equal(listItem.sync.status, "dead_letter");
      assert.equal(listItem.sync.errorCode, "MOCK_PROVIDER_FAILURE");
      assert.equal(listItem.sync.message, "The configured test provider failed.");
      assert.equal(listItem.sync.externalRecordId, null);
      assert.doesNotMatch(JSON.stringify(listItem.sync), /raw-provider-response|fake-token|17700000003|must-not-leak/);

      const detail = await request(baseUrl, `/api/admin/t/qianlin-travel/inquiries/${inquiryId}`, { headers: { cookie: ownerCookie } });
      assert.equal(detail.response.status, 200);
      assert.equal(detail.body.inquiry.sync.status, "dead_letter");
      assert.equal(detail.body.inquiry.sync.errorCode, "MOCK_PROVIDER_FAILURE");
      assert.equal(detail.body.inquiry.sync.message, "The configured test provider failed.");
      assert.equal(detail.body.inquiry.sync.externalRecordId, null);
      assert.doesNotMatch(JSON.stringify(detail.body.inquiry.sync), /raw-provider-response|fake-token|17700000003|must-not-leak/);

      const editorLogin = await request(baseUrl, "/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "sync-editor-test", password }) });
      assert.equal(editorLogin.response.status, 200);
      const editorCookie = (editorLogin.response.headers.get("set-cookie") ?? "").split(";", 1)[0];
      const editorRetry = await request(baseUrl, `/api/admin/t/qianlin-travel/inquiries/${inquiryId}/sync`, { method: "POST", headers: { origin: baseUrl, cookie: editorCookie } });
      assert.equal(editorRetry.response.status, 403);

      const ownerDeadLetterRetry = await request(baseUrl, `/api/admin/t/qianlin-travel/inquiries/${inquiryId}/sync`, { method: "POST", headers: { origin: baseUrl, cookie: ownerCookie } });
      assert.equal(ownerDeadLetterRetry.response.status, 200);
      // A failing manual retry may remain dead_letter because the automatic
      // retry limit was already reached; a 200 response proves an authorized
      // admin/owner can re-enter processing without exposing raw errors.
      assert.equal(ownerDeadLetterRetry.body.sync.status, "dead_letter");
      assert.equal(ownerDeadLetterRetry.body.sync.errorCode, "MOCK_PROVIDER_FAILURE");
      assert.doesNotMatch(JSON.stringify(ownerDeadLetterRetry.body), /raw-provider-response|fake-token|must-not-leak/);

      const crossTenantDeadLetterRetry = await request(baseUrl, `/api/admin/t/qianlin-travel/inquiries/${yunnanInquiryId}/sync`, { method: "POST", headers: { origin: baseUrl, cookie: ownerCookie } });
      assert.equal(crossTenantDeadLetterRetry.response.status, 404);
    }
    if (!failure) {
      const repeatedRetry = await request(baseUrl, `/api/admin/t/qianlin-travel/inquiries/${inquiryId}/sync`, { method: "POST", headers: { origin: baseUrl, cookie: ownerCookie } });
      assert.equal(repeatedRetry.response.status, 409);
      assert.equal(query(`SELECT COUNT(*) AS count FROM tenant_inquiry_sync_jobs WHERE tenant_id = 'qianlin-travel' AND inquiry_id = ${inquiryId} AND provider = 'mock'`)[0].count, 1);
      execute(`INSERT INTO tenant_inquiry_sync_jobs (id, tenant_id, inquiry_id, provider, status, idempotency_key) VALUES ('disabled-provider-switch-${inquiryId}', 'qianlin-travel', ${inquiryId}, 'disabled', 'not_configured', 'qianlin-travel:inquiry:${inquiryId}:provider:disabled')`);
      const providerSwitchRows = query(`SELECT provider, status FROM tenant_inquiry_sync_jobs WHERE tenant_id = 'qianlin-travel' AND inquiry_id = ${inquiryId} ORDER BY provider`);
      assert.deepEqual(providerSwitchRows, [{ provider: "disabled", status: "not_configured" }, { provider: "mock", status: "synced" }]);
    }
  } finally {
    console.log(`sync HTTP scenario cleanup: ${failure ? "failure" : "success"}`);
    if (server?.pid && server.exitCode === null) { try { if (process.platform === "win32") execFileSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore", timeout: 5000 }); else server.kill("SIGTERM"); } catch {} await new Promise((resolve) => setTimeout(resolve, 1500)); }
    server?.stdout?.destroy();
    server?.stderr?.destroy();
    server?.unref?.();
    await removeTempPath(statePath);
    await removeTempPath(logsPath);
    await removeTempPath(registryPath);
  }
}

async function main() {
  let original = null;
  let hadOriginal = false;
  try { original = await fs.readFile(devVarsPath, "utf8"); hadOriginal = true; } catch {}
  try { await fs.writeFile(devVarsPath, "ERP_PROVIDER=mock\n"); await runScenario({ failure: false }); await runScenario({ failure: true }); console.log("Local HTTP sync integration passed: decoupled submission, Mock success/failure, idempotent retry, tenant binding, and safe errors."); }
  finally { if (hadOriginal) await fs.writeFile(devVarsPath, original); else await fs.rm(devVarsPath, { force: true }); }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
