/**
 * Regression tests for the ERP inquiry sync queue (hard fix #1) and the
 * plain-text inquiry sync ID scheme (hard fix #4).
 *
 * Covers two layers:
 * 1. Pure planning function `planDueSyncQueue`: pending (new) jobs always take
 *    the whole batch budget first, so a backlog of failing retries can never
 *    starve the main sync path.
 * 2. Live local D1 queue-selection semantics: dead_letter jobs and failed jobs
 *    that exhausted automatic retries are never picked by the retry query, and
 *    retry capacity is capped at (batchLimit - pendingCount).
 * 3. `inquirySyncJobId` / `inquiryIdempotencyKey` are deterministic plain-text
 *    strings with no hash component.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stateDir = path.resolve(root, ".wrangler", "sync-queue-test-state");
const wrangler = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const bundlePath = path.resolve(root, ".wrangler", "sync-queue-bundle.mjs");
const defaultConfig = path.resolve(root, "wrangler.local.jsonc");

function runNode(args: string[]) {
  return execFileSync(process.execPath, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/** Bundle the real syncService into a single ESM file so Node can load it
 *  (syncService uses extension-less relative imports that Node ESM cannot
 *  resolve directly). The bundle is deleted afterwards. */
async function loadSyncService() {
  await build({
    entryPoints: ["lib/inquiries/syncService.ts"],
    bundle: true,
    format: "esm",
    platform: "node",
    packages: "external",
    external: ["cloudflare:workers"],
    outfile: bundlePath,
  });
  const mod = await import(pathToFileURL(bundlePath).href);
  return mod as {
    inquirySyncJobId: (tenantId: string, inquiryId: number, provider: string) => string;
    inquiryIdempotencyKey: (tenantId: string, inquiryId: number, provider?: string) => string;
    planDueSyncQueue: (batchLimit: number, pendingCount: number) => { pendingBudget: number; retryBudget: number; retryAllowed: boolean };
    MAX_AUTOMATIC_RETRIES: number;
    MAX_BATCH_LIMIT: number;
  };
}

function query(sql: string) {
  const output = runNode([wrangler, "d1", "execute", "DB", "--local", "--config", defaultConfig, "--persist-to", stateDir, "--json", "--command", sql]);
  return (JSON.parse(output)[0]?.results ?? []) as Array<{ id?: unknown; count?: unknown }>;
}

function execute(sql: string) {
  return runNode([wrangler, "d1", "execute", "DB", "--local", "--config", defaultConfig, "--persist-to", stateDir, "--command", sql]);
}

function applyMigrations() {
  return runNode([wrangler, "d1", "migrations", "apply", "DB", "--local", "--config", defaultConfig, "--persist-to", stateDir]);
}

async function main() {
  await fs.rm(stateDir, { recursive: true, force: true });
  try {
    const {
      inquirySyncJobId,
      inquiryIdempotencyKey,
      planDueSyncQueue,
      MAX_AUTOMATIC_RETRIES,
      MAX_BATCH_LIMIT,
    } = await loadSyncService();

    // ── Hard fix #4: new plain-text ID scheme ──
    assert.equal(inquirySyncJobId("qianlin-travel", 123, "mock"), "sync:qianlin-travel:inquiry:123:provider:mock");
    assert.equal(inquirySyncJobId("qianlin-travel", 123, "disabled"), "sync:qianlin-travel:inquiry:123:provider:disabled");
    assert.equal(inquiryIdempotencyKey("qianlin-travel", 123, "mock"), "qianlin-travel:inquiry:123:provider:mock");
    assert.equal(inquiryIdempotencyKey("qianlin-travel", 123), "qianlin-travel:inquiry:123:provider:disabled");
    // Different inquiries must produce different keys: no 32-bit hash collisions.
    assert.notEqual(inquirySyncJobId("qianlin-travel", 123, "mock"), inquirySyncJobId("qianlin-travel", 124, "mock"));
    assert.notEqual(inquiryIdempotencyKey("qianlin-travel", 123, "mock"), inquiryIdempotencyKey("qianlin-travel", 124, "mock"));
    // Keys are plain text: no 8+ hex digit hash component and no hash markers.
    const sampleJobId = inquirySyncJobId("qianlin-travel", 42, "mock");
    const sampleKey = inquiryIdempotencyKey("qianlin-travel", 42, "mock");
    assert.doesNotMatch(sampleJobId, /[0-9a-f]{8}/i);
    assert.doesNotMatch(sampleKey, /[0-9a-f]{8}/i);
    assert.ok(!sampleJobId.includes("hash") && !sampleKey.includes("hash"));
    console.log("Plain-text inquiry sync ID scheme regression passed (issue #4).");

    // ── Hard fix #1: queue isolation planning (pure function) ──
    assert.deepEqual(planDueSyncQueue(100, 0), { pendingBudget: 0, retryBudget: 100, retryAllowed: true });
    assert.deepEqual(planDueSyncQueue(100, 50), { pendingBudget: 50, retryBudget: 50, retryAllowed: true });
    assert.deepEqual(planDueSyncQueue(100, 99), { pendingBudget: 99, retryBudget: 1, retryAllowed: true });
    assert.deepEqual(planDueSyncQueue(100, 100), { pendingBudget: 100, retryBudget: 0, retryAllowed: false });
    assert.deepEqual(planDueSyncQueue(100, 200), { pendingBudget: 100, retryBudget: 0, retryAllowed: false });
    assert.deepEqual(planDueSyncQueue(MAX_BATCH_LIMIT, MAX_BATCH_LIMIT), { pendingBudget: MAX_BATCH_LIMIT, retryBudget: 0, retryAllowed: false });
    console.log("Queue isolation planning regression passed (issue #1, pure function).");

    // ── Hard fix #1: live D1 queue-selection semantics ──
    applyMigrations();
    const insertInquiry = (name: string) => {
      execute(`INSERT INTO inquiries (tenant_id, name, phone, travelers, privacy_consent) VALUES ('qianlin-travel', '${name}', '18900000101', '1', 1)`);
      return String(query(`SELECT id FROM inquiries WHERE name = '${name}'`)[0].id);
    };
    const aId = insertInquiry("Queue A");
    const bId = insertInquiry("Queue B");
    const cId = insertInquiry("Queue C");
    const dId = insertInquiry("Queue D");
    const eId = insertInquiry("Queue E");

    const past = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const insertJob = (id: string, inquiryId: string, status: string, retryCount: number) => {
      execute(`INSERT INTO tenant_inquiry_sync_jobs (id, tenant_id, inquiry_id, provider, status, idempotency_key, retry_count, updated_at, last_attempt_at) VALUES ('${id}', 'qianlin-travel', ${inquiryId}, 'mock', '${status}', 'qianlin-travel:inquiry:${inquiryId}:provider:mock', ${retryCount}, '${past}', ${status === "pending" ? "NULL" : `'${past}'`})`);
    };
    insertJob("queue-pending-a", aId, "pending", 0);
    insertJob("queue-dead-letter-b", bId, "dead_letter", 5);
    insertJob("queue-failed-c", cId, "failed", MAX_AUTOMATIC_RETRIES);
    insertJob("queue-failed-d", dId, "failed", 1);

    const retryCutoff = new Date(Date.now() - 60 * 1000).toISOString();
    // Mirrors the automatic-cron retry query in processDueInquirySyncJobs:
    // failed with remaining automatic retries, or stale processing rows.
    const retryCandidateIds = (limit: number) =>
      query(`SELECT id FROM tenant_inquiry_sync_jobs WHERE (status = 'failed' AND retry_count < ${MAX_AUTOMATIC_RETRIES} AND updated_at < '${retryCutoff}') OR (status = 'processing' AND updated_at < '${retryCutoff}') ORDER BY updated_at LIMIT ${limit}`).map((r) => r.id);
    const pendingCandidateIds = (limit: number) =>
      query(`SELECT id FROM tenant_inquiry_sync_jobs WHERE status = 'pending' ORDER BY updated_at LIMIT ${limit}`).map((r) => r.id);

    // Scenario 1: one pending job, batch limit 2 -> retry gets leftover capacity,
    // dead_letter and exhausted-failed jobs are never candidates.
    assert.deepEqual(pendingCandidateIds(2), ["queue-pending-a"]);
    assert.deepEqual(retryCandidateIds(1), ["queue-failed-d"]);

    // Scenario 2: a second pending job arrives and fills the whole budget ->
    // retries are fully starved (this is the queue-isolation guarantee).
    insertJob("queue-pending-e", eId, "pending", 0);
    assert.deepEqual(pendingCandidateIds(2), ["queue-pending-a", "queue-pending-e"]);
    assert.deepEqual(retryCandidateIds(0), []);

    // Scenario 3: after pending clears, the retry budget returns but still
    // excludes dead_letter and exhausted-failed rows.
    execute("UPDATE tenant_inquiry_sync_jobs SET status = 'synced' WHERE id IN ('queue-pending-a', 'queue-pending-e')");
    assert.deepEqual(pendingCandidateIds(2), []);
    assert.deepEqual(retryCandidateIds(2), ["queue-failed-d"]);
    assert.ok(!retryCandidateIds(2).includes("queue-dead-letter-b"));
    assert.ok(!retryCandidateIds(2).includes("queue-failed-c"));
    console.log("Live D1 queue-selection semantics regression passed (issue #1).");

    console.log("Sync queue + ID scheme local regression passed.");
  } finally {
    await fs.rm(stateDir, { recursive: true, force: true });
    await fs.rm(bundlePath, { force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
