import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const configPath = path.resolve(root, "wrangler.local.jsonc");
const statePath = path.resolve(root, ".wrangler", `maintenance-test-${Date.now()}-${process.pid}`);
const logsPath = path.join(statePath, "logs");
const registryPath = path.join(statePath, "registry");

function runWrangler(args) {
  return execFileSync(process.execPath, [wrangler, ...args], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function query(sql) {
  return JSON.parse(runWrangler(["d1", "execute", "DB", "--local", "--config", configPath, "--persist-to", statePath, "--json", "--command", sql]))[0]?.results ?? [];
}

function execute(sql) {
  runWrangler(["d1", "execute", "DB", "--local", "--config", configPath, "--persist-to", statePath, "--command", sql]);
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(typeof address === "object" && address ? address.port : 0));
    });
  });
}

async function waitForWorker(baseUrl, output, server) {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`maintenance worker exited: ${output.join("").slice(-2000)}`);
    try {
      const response = await fetch(`${baseUrl}/api/t/qianlin-travel/site-config`);
      if (response.status === 200) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`maintenance worker did not become ready: ${output.join("").slice(-2000)}`);
}

async function triggerScheduled(baseUrl) {
  const response = await fetch(`${baseUrl}/cdn-cgi/local/scheduled?cron=0%20*%20*%20*%20*`);
  assert.equal(response.status, 200);
}

async function main() {
  await fs.rm(statePath, { recursive: true, force: true });
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const output = [];
  let server;
  try {
    runWrangler(["d1", "migrations", "apply", "DB", "--local", "--config", configPath, "--persist-to", statePath]);

    const retentionRows = [
      ["qianlin-travel", "retention-expired", "2000-01-01T00:00:00.000Z"],
      ["qianlin-travel", "retention-future", "2999-01-01T00:00:00.000Z"],
      ["qianlin-travel", "sync-pending", "2999-01-01T00:00:00.000Z"],
      ["yunnan-demo", "retention-demo-expired", "2000-01-01T00:00:00.000Z"],
      ["yunnan-demo", "retention-demo-future", "2999-01-01T00:00:00.000Z"],
    ];
    const backlogRows = Array.from({ length: 105 }, (_, index) => ["qianlin-travel", `retention-backlog-${index}`, "2000-01-01T00:00:00.000Z"]);
    const inquiryRows = [...retentionRows, ...backlogRows];
    execute(`INSERT INTO inquiries (tenant_id, name, phone, wechat, email, location, travel_date, travelers, duration, tour_name, places, message, privacy_consent, privacy_consent_at, privacy_policy_version, retention_until, status) VALUES ${inquiryRows.map(([tenant, name, retentionUntil]) => `('${tenant}', '${name}', '17700000000', 'fake-wechat', 'fake-${name}@example.invalid', '测试地点', '2099-01-01', '2', '3天', '虚构线路', '虚构目的地', '人工构造的测试留言', 1, '2026-01-01T00:00:00.000Z', 'v-test', '${retentionUntil}', 'new')`).join(",")}`);

    const terminalRows = query("SELECT id, tenant_id FROM inquiries WHERE name LIKE 'retention-backlog-%' OR name IN ('retention-future', 'retention-demo-future')");
    execute(`INSERT INTO tenant_inquiry_sync_jobs (id, tenant_id, inquiry_id, provider, status, idempotency_key, retry_count, last_attempt_at, updated_at) VALUES ${terminalRows.map((row) => `('terminal-${row.id}', '${row.tenant_id}', ${row.id}, 'mock', 'failed', '${row.tenant_id}:inquiry:${row.id}:provider:mock', 5, datetime('now', '-2 hours'), datetime('now', '-2 hours'))`).join(",")}`);
    const pendingInquiry = query("SELECT id FROM inquiries WHERE name = 'sync-pending'")[0].id;
    execute(`INSERT INTO tenant_inquiry_sync_jobs (id, tenant_id, inquiry_id, provider, status, idempotency_key, retry_count) VALUES ('pending-maintenance-job', 'qianlin-travel', ${pendingInquiry}, 'mock', 'pending', 'qianlin-travel:inquiry:${pendingInquiry}:provider:mock', 0)`);
    const demoExpired = query("SELECT id FROM inquiries WHERE name = 'retention-demo-expired'")[0].id;
    execute(`INSERT INTO tenant_inquiry_sync_jobs (id, tenant_id, inquiry_id, provider, status, idempotency_key, retry_count) VALUES ('demo-terminal-job', 'yunnan-demo', ${demoExpired}, 'mock', 'failed', 'yunnan-demo:inquiry:${demoExpired}:provider:mock', 5)`);

    server = spawn(process.execPath, [wrangler, "dev", "--local", "--config", configPath, "--persist-to", statePath, "--port", String(port)], {
      cwd: root,
      env: { ...process.env, NODE_ENV: "test", ERP_PROVIDER: "mock", ERP_MOCK_FAILURE: "false", CLOUDFLARE_PERSIST_STATE_PATH: statePath, WRANGLER_WRITE_LOGS: "false", WRANGLER_LOG_PATH: logsPath, MINIFLARE_REGISTRY_PATH: registryPath },
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stdout.on("data", (chunk) => output.push(String(chunk)));
    server.stderr.on("data", (chunk) => output.push(String(chunk)));
    await waitForWorker(baseUrl, output, server);

    await triggerScheduled(baseUrl);
    const firstExpired = query("SELECT name, phone, wechat, email, location, travel_date, travelers, duration, tour_name, places, message, tenant_id, privacy_consent_at, privacy_policy_version, created_at, anonymized_at, updated_at FROM inquiries WHERE name = 'retention-expired'")[0];
    assert.equal(firstExpired.name, "已匿名化");
    for (const field of ["phone", "wechat", "email", "location", "travel_date", "travelers", "duration", "tour_name", "places", "message"]) assert.equal(firstExpired[field], "");
    assert.equal(firstExpired.tenant_id, "qianlin-travel");
    assert.equal(firstExpired.privacy_consent_at, "2026-01-01T00:00:00.000Z");
    assert.equal(firstExpired.privacy_policy_version, "v-test");
    assert.ok(firstExpired.anonymized_at);
    assert.ok(firstExpired.updated_at);

    const futureSnapshot = query("SELECT name, phone, wechat, email, message, anonymized_at FROM inquiries WHERE name IN ('retention-future', 'retention-demo-future') ORDER BY name");
    assert.deepEqual(futureSnapshot, [
      { name: "retention-demo-future", phone: "17700000000", wechat: "fake-wechat", email: "fake-retention-demo-future@example.invalid", message: "人工构造的测试留言", anonymized_at: null },
      { name: "retention-future", phone: "17700000000", wechat: "fake-wechat", email: "fake-retention-future@example.invalid", message: "人工构造的测试留言", anonymized_at: null },
    ]);
    assert.equal(query("SELECT COUNT(*) AS count FROM inquiries WHERE anonymized_at IS NOT NULL")[0].count, 100);
    assert.equal(query("SELECT COUNT(*) AS count FROM inquiries WHERE tenant_id = 'yunnan-demo' AND name = '已匿名化'")[0].count, 1);

    const pendingState = query("SELECT status, retry_count, external_record_id FROM tenant_inquiry_sync_jobs WHERE id = 'pending-maintenance-job'")[0];
    assert.equal(pendingState.status, "synced");
    assert.equal(pendingState.retry_count, 1);
    assert.match(pendingState.external_record_id, /^mock-/);
    assert.equal(query("SELECT COUNT(*) AS count FROM tenant_inquiry_sync_jobs WHERE status = 'failed' AND retry_count = 5")[0].count, 108);

    await triggerScheduled(baseUrl);
    assert.equal(query("SELECT COUNT(*) AS count FROM inquiries WHERE anonymized_at IS NOT NULL")[0].count, 106);
    assert.equal(query("SELECT COUNT(*) AS count FROM tenant_inquiry_sync_jobs WHERE status = 'failed' AND retry_count = 5")[0].count, 108);
    assert.equal(query("SELECT tenant_id, status FROM tenant_inquiry_sync_jobs WHERE id = 'demo-terminal-job'")[0].tenant_id, "yunnan-demo");
    console.log("Local maintenance integration passed: real D1 retention anonymization, batch continuation, tenant boundaries, terminal retry starvation protection, and pending sync processing.");
  } finally {
    if (server?.pid && server.exitCode === null) {
      try { if (process.platform === "win32") execFileSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore", timeout: 5000 }); else server.kill("SIGTERM"); } catch {}
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    server?.stdout?.destroy();
    server?.stderr?.destroy();
    server?.unref?.();
    await fs.rm(statePath, { recursive: true, force: true }).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
