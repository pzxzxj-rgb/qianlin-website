import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const migrationConfigPath = path.resolve(root, "wrangler.local.jsonc");
const builtWorkerPath = path.resolve(root, "dist", "server", "index.js");
const builtWorkerConfigPath = path.resolve(root, "dist", "server", "wrangler.json");
const vinext = path.resolve(root, "node_modules", "vinext", "dist", "cli.js");
const statePath = path.resolve(root, ".wrangler", `maintenance-test-${Date.now()}-${process.pid}`);
const logsPath = path.join(statePath, "logs");
const registryPath = path.join(statePath, "registry");
const REQUEST_TIMEOUT_MS = 30_000;
let localConfigPath = migrationConfigPath;

function runWrangler(args) {
  return execFileSync(process.execPath, [wrangler, ...args], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

async function ensureBuiltWorker() {
  const scheduledSources = [
    path.resolve(root, "worker", "index.ts"),
    path.resolve(root, "lib", "inquiries", "retention.ts"),
    path.resolve(root, "lib", "inquiries", "syncService.ts"),
    path.resolve(root, "lib", "integrations", "erp", "providerFactory.ts"),
  ];
  const output = await fs.stat(builtWorkerPath).catch(() => null);
  const config = await fs.stat(builtWorkerConfigPath).catch(() => null);
  const sources = await Promise.all(scheduledSources.map((source) => fs.stat(source)));
  const sourceModifiedAt = Math.max(...sources.map((source) => source.mtimeMs));
  if (output && config && output.mtimeMs >= sourceModifiedAt && config.mtimeMs >= sourceModifiedAt) return;
  try {
    execFileSync(process.execPath, [vinext, "build"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    const details = error && typeof error === "object" && "stderr" in error ? String(error.stderr) : String(error);
    throw new Error(`unable to build the Worker required for scheduled integration testing: ${details}`);
  }
}

async function createScheduledWorkerConfig() {
  // Start from the repository's local-D1 config so the migration CLI and the
  // Worker resolve the exact same local D1 binding and persistence layout.
  const config = JSON.parse(await fs.readFile(migrationConfigPath, "utf8"));
  // Use Vinext's compiled Worker instead of the source entry: the source
  // imports a Vite-only virtual module that Wrangler cannot resolve directly.
  config.main = builtWorkerPath;
  config.assets = { directory: path.resolve(root, "dist", "client") };
  config.vars = { APP_ENV: "test", ERP_PROVIDER: "mock", ERP_MOCK_FAILURE: "false" };
  config.d1_databases = (config.d1_databases ?? []).map((database) => ({ ...database, migrations_dir: path.resolve(root, "drizzle") }));
  // --test-scheduled injects Wrangler middleware during bundling. Vinext's
  // deployment config sets no_bundle, which otherwise prevents /__scheduled
  // from being installed for this local-only test worker.
  delete config.no_bundle;
  delete config.build;
  const testConfigPath = path.join(statePath, "scheduled-worker.wrangler.json");
  await fs.mkdir(statePath, { recursive: true });
  await fs.writeFile(testConfigPath, JSON.stringify(config));
  return testConfigPath;
}

function query(sql) {
  return JSON.parse(runWrangler(["d1", "execute", "DB", "--local", "--config", localConfigPath, "--persist-to", statePath, "--json", "--command", sql]))[0]?.results ?? [];
}

function execute(sql) {
  runWrangler(["d1", "execute", "DB", "--local", "--config", localConfigPath, "--persist-to", statePath, "--command", sql]);
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

async function fetchWithin(url, timeoutMs, init = {}) {
  const controller = new AbortController();
  let timeout;
  const request = fetch(url, { ...init, signal: controller.signal });
  // AbortController is required for the underlying connection, while the race
  // makes the test's own control flow bounded even if a runtime does not settle
  // the aborted fetch promptly.
  const expiration = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new Error(`request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([request, expiration]);
  } finally {
    clearTimeout(timeout);
    // Consume a late fetch rejection after the timeout race has already won.
    void request.catch(() => undefined);
  }
}

async function waitForWorker(baseUrl, output, server) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`maintenance worker exited: ${output.join("").slice(-2000)}`);
    try {
      const response = await fetchWithin(`${baseUrl}/api/t/qianlin-travel/site-config`, 1_000);
      if (response.status === 200) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`maintenance worker did not become ready: ${output.join("").slice(-2000)}`);
}

async function triggerScheduled(baseUrl, output, server) {
  // Wrangler's `--test-scheduled` flag exposes the real scheduled entry point at
  // `/__scheduled`; the `cron` query matches the Worker's configured cron. A
  // timeout guard ensures the test never hangs if the scheduled handler fails
  // to respond, and any failure surfaces the captured Worker output.
  try {
    if (server.exitCode !== null) throw new Error("worker exited before scheduled request");
    const response = await fetchWithin(`${baseUrl}/__scheduled?cron=0%20*%20*%20*%20*`, REQUEST_TIMEOUT_MS);
    assert.equal(response.status, 200);
  } catch (error) {
    if (error instanceof Error && error.message.includes("timed out")) throw new Error(`scheduled request timed out after ${REQUEST_TIMEOUT_MS / 1000}s; worker output:\n${output.join("").slice(-3000)}`);
    throw new Error(`scheduled request failed: ${error instanceof Error ? error.message : String(error)}\nworker output:\n${output.join("").slice(-3000)}`);
  }
}

async function stopWorker(server) {
  if (server?.pid && server.exitCode === null) {
    try {
      if (process.platform === "win32") execFileSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore", timeout: 5_000 });
      else server.kill("SIGTERM");
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
}

async function waitForMaintenanceEvents(output, server, count) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`maintenance worker exited before completing scheduled work: ${output.join("").slice(-3000)}`);
    const events = output.join("").match(/\{\"event\":\"inquiry_maintenance_completed\"[^\n]*\}/g) ?? [];
    if (events.length >= count) return events.map((event) => JSON.parse(event));
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`scheduled maintenance did not complete within 30s; worker output:\n${output.join("").slice(-3000)}`);
}

async function main() {
  await fs.rm(statePath, { recursive: true, force: true });
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const output = [];
  let server;
  try {
    await ensureBuiltWorker();
    const scheduledWorkerConfigPath = await createScheduledWorkerConfig();
    localConfigPath = scheduledWorkerConfigPath;
    runWrangler(["d1", "migrations", "apply", "DB", "--local", "--config", localConfigPath, "--persist-to", statePath]);

    const retentionRows = [
      ["qianlin-travel", "retention-expired", "2000-01-01T00:00:00.000Z"],
      ["qianlin-travel", "retention-future", "2999-01-01T00:00:00.000Z"],
      ["qianlin-travel", "sync-pending", "2999-01-01T00:00:00.000Z"],
      ["qianlin-travel", "provider-switch", "2999-01-01T00:00:00.000Z"],
      ["qianlin-travel", "provider-switch-anonymized", "2999-01-01T00:00:00.000Z"],
      ["yunnan-demo", "retention-demo-expired", "2000-01-01T00:00:00.000Z"],
      ["yunnan-demo", "retention-demo-future", "2999-01-01T00:00:00.000Z"],
    ];
    const backlogRows = Array.from({ length: 105 }, (_, index) => ["qianlin-travel", `retention-backlog-${index}`, "2000-01-01T00:00:00.000Z"]);
    const inquiryRows = [...retentionRows, ...backlogRows];
    for (let index = 0; index < inquiryRows.length; index += 20) {
      const batch = inquiryRows.slice(index, index + 20);
      execute(`INSERT INTO inquiries (tenant_id, submission_id, name, phone, wechat, email, location, travel_date, travelers, duration, tour_name, places, message, privacy_consent, privacy_consent_at, privacy_policy_version, retention_until, status) VALUES ${batch.map(([tenant, name, retentionUntil]) => `('${tenant}', '${crypto.randomUUID()}', '${name}', '17700000000', 'fake-wechat', 'fake-${name}@example.invalid', '测试地点', '2099-01-01', '2', '3天', '虚构线路', '虚构目的地', '人工构造的测试留言', 1, '2026-01-01T00:00:00.000Z', 'v-test', '${retentionUntil}', 'new')`).join(",")}`);
    }

    const terminalRows = query("SELECT id, tenant_id FROM inquiries WHERE name LIKE 'retention-backlog-%' OR name IN ('retention-future', 'retention-demo-future')");
    for (let index = 0; index < terminalRows.length; index += 20) {
      const batch = terminalRows.slice(index, index + 20);
      execute(`INSERT INTO tenant_inquiry_sync_jobs (id, tenant_id, inquiry_id, provider, status, idempotency_key, retry_count, last_attempt_at, updated_at) VALUES ${batch.map((row) => `('terminal-${row.id}', '${row.tenant_id}', ${row.id}, 'mock', 'failed', '${row.tenant_id}:inquiry:${row.id}:provider:mock', 5, datetime('now', '-2 hours'), datetime('now', '-2 hours'))`).join(",")}`);
    }
    const pendingInquiry = query("SELECT id FROM inquiries WHERE name = 'sync-pending'")[0].id;
    execute(`INSERT INTO tenant_inquiry_sync_jobs (id, tenant_id, inquiry_id, provider, status, idempotency_key, retry_count) VALUES ('pending-maintenance-job', 'qianlin-travel', ${pendingInquiry}, 'mock', 'pending', 'qianlin-travel:inquiry:${pendingInquiry}:provider:mock', 0)`);
    const providerSwitchInquiry = query("SELECT id FROM inquiries WHERE name = 'provider-switch'")[0].id;
    const anonymizedProviderSwitchInquiry = query("SELECT id FROM inquiries WHERE name = 'provider-switch-anonymized'")[0].id;
    execute(`INSERT INTO tenant_inquiry_sync_jobs (id, tenant_id, inquiry_id, provider, status, idempotency_key) VALUES ('provider-switch-disabled-job', 'qianlin-travel', ${providerSwitchInquiry}, 'disabled', 'not_configured', 'qianlin-travel:inquiry:${providerSwitchInquiry}:provider:disabled')`);
    execute(`INSERT INTO tenant_inquiry_sync_jobs (id, tenant_id, inquiry_id, provider, status, idempotency_key) VALUES ('provider-switch-anonymized-disabled-job', 'qianlin-travel', ${anonymizedProviderSwitchInquiry}, 'disabled', 'not_configured', 'qianlin-travel:inquiry:${anonymizedProviderSwitchInquiry}:provider:disabled')`);
    execute(`UPDATE inquiries SET anonymized_at = '2026-01-02T00:00:00.000Z' WHERE id = ${anonymizedProviderSwitchInquiry}`);
    assert.equal(query("SELECT COUNT(*) AS count FROM inquiries WHERE anonymized_at IS NOT NULL")[0].count, 1);
    assert.equal(query("SELECT status FROM tenant_inquiry_sync_jobs WHERE id = 'pending-maintenance-job'")[0].status, "pending");
    assert.equal(query(`SELECT COUNT(*) AS count FROM tenant_inquiry_sync_jobs WHERE tenant_id = 'qianlin-travel' AND inquiry_id = ${providerSwitchInquiry} AND provider = 'mock'`)[0].count, 0);
    const demoExpired = query("SELECT id FROM inquiries WHERE name = 'retention-demo-expired'")[0].id;
    execute(`INSERT INTO tenant_inquiry_sync_jobs (id, tenant_id, inquiry_id, provider, status, idempotency_key, retry_count) VALUES ('demo-terminal-job', 'yunnan-demo', ${demoExpired}, 'mock', 'failed', 'yunnan-demo:inquiry:${demoExpired}:provider:mock', 5)`);
    const sessionNow = Math.floor(Date.now() / 1000);
    execute("INSERT INTO users (id, username, password_hash, status) VALUES ('maintenance-session-user', 'maintenance-session-user', 'test-only-hash', 'active')");
    execute(`INSERT INTO sessions (id, user_id, token_hash, expires_at, revoked_at) VALUES
      ('expired-session', 'maintenance-session-user', 'expired-session-hash', ${sessionNow - 1}, NULL),
      ('old-revoked-session', 'maintenance-session-user', 'old-revoked-session-hash', ${sessionNow + 3600}, ${sessionNow - 8 * 24 * 60 * 60}),
      ('recent-revoked-session', 'maintenance-session-user', 'recent-revoked-session-hash', ${sessionNow + 3600}, ${sessionNow - 24 * 60 * 60}),
      ('active-session', 'maintenance-session-user', 'active-session-hash', ${sessionNow + 3600}, NULL)`);

    // Wrangler must execute Vinext's built Worker. The source worker imports a
    // Vite-only virtual module, so direct source bundling cannot exercise the
    // real scheduled() implementation.
    server = spawn(process.execPath, [wrangler, "dev", "--local", "--config", scheduledWorkerConfigPath, "--persist-to", statePath, "--port", String(port), "--test-scheduled"], {
      cwd: root,
      env: { ...process.env, APP_ENV: "test", ERP_PROVIDER: "mock", ERP_MOCK_FAILURE: "false", CLOUDFLARE_PERSIST_STATE_PATH: statePath, WRANGLER_WRITE_LOGS: "false", WRANGLER_LOG_PATH: logsPath, WRANGLER_REGISTRY_PATH: registryPath },
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stdout.on("data", (chunk) => output.push(String(chunk)));
    server.stderr.on("data", (chunk) => output.push(String(chunk)));
    await waitForWorker(baseUrl, output, server);

    await triggerScheduled(baseUrl, output, server);
    // The scheduled middleware returns after waitUntil() is registered. Trigger
    // a second cron run so retention's bounded first batch can continue.
    await triggerScheduled(baseUrl, output, server);
    const [firstRun, secondRun] = await waitForMaintenanceEvents(output, server, 2);
    console.log(`Scheduled maintenance results: ${JSON.stringify([firstRun, secondRun])}`);
    assert.equal(firstRun.anonymized, 100);
    assert.equal(secondRun.anonymized, 7);
    assert.equal(firstRun.sessions, 2);
    assert.equal(secondRun.sessions, 0);
    assert.equal(query("SELECT COUNT(*) AS count FROM sessions")[0].count, 2);
    assert.equal(query("SELECT COUNT(*) AS count FROM sessions WHERE id IN ('recent-revoked-session', 'active-session')")[0].count, 2);
    assert.ok(firstRun.compensated >= 1, "the first scheduled run must backfill current-provider jobs");
    assert.ok(firstRun.processed + secondRun.processed >= 1, "scheduled runs must process pending sync work");
    assert.equal(firstRun.queueHealth.failed, 108);
    assert.equal(firstRun.queueHealth.dead_letter, 0);
    assert.equal(secondRun.queueHealth.failed, 108);
    console.log("Local maintenance integration passed: real worker.scheduled() retention anonymization, session cleanup, batch continuation, tenant boundaries, terminal retry starvation protection, pending sync processing, and provider-switch compensation.");
  } finally {
    await stopWorker(server);
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
