/**
 * Retention / anonymization integration tests that drive the REAL
 * `anonymizeExpiredInquiries()` implementation against a live local D1
 * instance (via Miniflare, which applies the drizzle migrations itself).
 *
 * This replaces the previous raw-SQL simulation that used to live in
 * test-local-d1.mjs: the production function is now the only thing under
 * test, including its tenant-scoped UPDATE statements, idempotency guard
 * and compliance-field preservation.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Miniflare } from "miniflare";
import { anonymizeExpiredInquiries } from "../lib/inquiries/retention.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stateDir = path.resolve(root, ".wrangler", "retention-test-state");
const drizzleDir = path.resolve(root, "drizzle");
const databaseId = "00000000-0000-4000-8000-000000000000";

/** Apply every drizzle migration file (0000..NNNN) directly on the live D1
 *  instance, keeping the whole test inside Miniflare's own persistence
 *  (wrangler and Miniflare use different persist layouts, so they must not
 *  be mixed). */
async function applySqlMigrations(db: D1Database) {
  const files = (await fs.readdir(drizzleDir)).filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f)).sort();
  for (const file of files) {
    const content = await fs.readFile(path.join(drizzleDir, file), "utf8");
    for (const statement of content.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean)) {
      await db.prepare(statement).run();
    }
  }
}

async function main() {
  await fs.rm(stateDir, { recursive: true, force: true });
  let mf: Miniflare | undefined;
  try {
    mf = new Miniflare({
      modules: true,
      script: `export default { async fetch() { return new Response("ok"); } }`,
      d1Databases: { DB: databaseId },
      resourcePersistencePath: stateDir,
    });
    const db = await mf.getD1Database("DB");
    await applySqlMigrations(db);

    const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const pastDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();

    const insert = async (tenantId: string, name: string, phone: string, wechat: string, email: string, retentionUntil: string) => {
      await db.prepare(`INSERT INTO inquiries (tenant_id, name, phone, wechat, email, location, travel_date, travelers, duration, tour_name, places, message, privacy_consent, retention_until, status) VALUES (?, ?, ?, ?, ?, 'Guiyang', '2025-06-01', '2', '3 days', 'Tour test', 'Guizhou', 'Test inquiry message', 1, ?, 'new')`)
        .bind(tenantId, name, phone, wechat, email, retentionUntil).run();
    };
    await insert("qianlin-travel", "Expired test", "18900000001", "wx_expired_1", "expired@test.invalid", pastDate);
    await insert("qianlin-travel", "Not expired test", "18900000002", "wx_not_expired", "notexpired@test.invalid", futureDate);
    await insert("yunnan-demo", "Tenant B expired", "18900000003", "wx_b_expired", "bexpired@test.invalid", pastDate);
    await insert("yunnan-demo", "Tenant B not expired", "18900000004", "wx_b_not", "bnotexpired@test.invalid", futureDate);

    const expiredId = await db.prepare("SELECT id FROM inquiries WHERE name = 'Expired test'").all<{ id: number }>();
    const notExpiredId = await db.prepare("SELECT id FROM inquiries WHERE name = 'Not expired test'").all<{ id: number }>();
    const bExpiredId = await db.prepare("SELECT id FROM inquiries WHERE name = 'Tenant B expired'").all<{ id: number }>();
    const bNotExpiredId = await db.prepare("SELECT id FROM inquiries WHERE name = 'Tenant B not expired'").all<{ id: number }>();
    const idA = expiredId.results[0].id;
    const idB = notExpiredId.results[0].id;
    const idC = bExpiredId.results[0].id;
    const idD = bNotExpiredId.results[0].id;

    // Pre-anonymization state.
    const preExpired = await db.prepare("SELECT name, phone, anonymized_at FROM inquiries WHERE id = ?").bind(idA).all<{ name: string; phone: string; anonymized_at: string | null }>();
    assert.equal(preExpired.results[0].name, "Expired test");
    assert.equal(preExpired.results[0].phone, "18900000001");
    assert.equal(preExpired.results[0].anonymized_at, null);

    // Run the real production function against the live D1 instance.
    const anonymized = await anonymizeExpiredInquiries(db, new Date(), 100);
    assert.equal(anonymized, 2, "Only the two expired inquiries should be anonymized");

    // Tenant A expired inquiry is anonymized, including its PII columns.
    const postA = await db.prepare(`SELECT name, phone, wechat, email, location, travel_date, travelers, duration, tour_name, places, message, anonymized_at, tenant_id FROM inquiries WHERE id = ?`).bind(idA).all<Record<string, unknown>>();
    const a = postA.results[0];
    assert.equal(a.name, "已匿名化");
    assert.equal(a.phone, "");
    assert.equal(a.wechat, "");
    assert.equal(a.email, "");
    assert.equal(a.location, "");
    assert.equal(a.travel_date, "");
    assert.equal(a.travelers, "");
    assert.equal(a.duration, "");
    assert.equal(a.tour_name, "");
    assert.equal(a.places, "");
    assert.equal(a.message, "");
    assert.notEqual(a.anonymized_at, null);
    assert.equal(a.tenant_id, "qianlin-travel");

    // Tenant A non-expired inquiry is unchanged.
    const postB = await db.prepare("SELECT name, phone, anonymized_at FROM inquiries WHERE id = ?").bind(idB).all<Record<string, unknown>>();
    assert.equal(postB.results[0].name, "Not expired test");
    assert.equal(postB.results[0].phone, "18900000002");
    assert.equal(postB.results[0].anonymized_at, null);

    // Tenant B expired inquiry is anonymized.
    const postC = await db.prepare("SELECT name, phone, anonymized_at, tenant_id FROM inquiries WHERE id = ?").bind(idC).all<Record<string, unknown>>();
    assert.equal(postC.results[0].name, "已匿名化");
    assert.equal(postC.results[0].phone, "");
    assert.notEqual(postC.results[0].anonymized_at, null);
    assert.equal(postC.results[0].tenant_id, "yunnan-demo");

    // Tenant B non-expired inquiry is unchanged.
    const postD = await db.prepare("SELECT name, phone, anonymized_at FROM inquiries WHERE id = ?").bind(idD).all<Record<string, unknown>>();
    assert.equal(postD.results[0].name, "Tenant B not expired");
    assert.equal(postD.results[0].phone, "18900000004");
    assert.equal(postD.results[0].anonymized_at, null);

    // Idempotency: a second run anonymizes nothing and does not touch records.
    const reAnonymized = await anonymizeExpiredInquiries(db, new Date(), 100);
    assert.equal(reAnonymized, 0, "Idempotent: no expired inquiries should remain after anonymization");
    const rePostA = await db.prepare("SELECT name, anonymized_at FROM inquiries WHERE id = ?").bind(idA).all<Record<string, unknown>>();
    assert.equal(rePostA.results[0].name, "已匿名化");

    // Compliance fields are preserved on the anonymized record.
    const compliance = await db.prepare("SELECT tenant_id, privacy_consent_at, privacy_policy_version, created_at FROM inquiries WHERE id = ?").bind(idA).all<Record<string, unknown>>();
    assert.equal(compliance.results[0].tenant_id, "qianlin-travel");
    assert.notEqual(compliance.results[0].privacy_policy_version, "");

    console.log("Retention anonymization real-function tests passed: Tenant A/B expired/non-expired, idempotency, compliance field preservation.");
  } finally {
    await mf?.dispose();
    await fs.rm(stateDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
