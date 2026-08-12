import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const freshState = path.resolve(root, ".wrangler", "test-state");
const legacyState = path.resolve(root, ".wrangler", "legacy-migration-state");
const legacyMigrations = path.resolve(root, ".wrangler", "legacy-migrations");
const legacyConfig = path.resolve(root, ".wrangler", "legacy-wrangler.json");
const mismatchState = path.resolve(root, ".wrangler", "mismatch-migration-state");
const mismatchMigrations = path.resolve(root, ".wrangler", "mismatch-migrations");
const mismatchConfig = path.resolve(root, ".wrangler", "mismatch-wrangler.json");
const wrangler = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const defaultConfig = path.resolve(root, "wrangler.local.jsonc");

function runWrangler(args) {
  return execFileSync(process.execPath, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function query(sql, statePath, configPath = defaultConfig) {
  const output = runWrangler([wrangler, "d1", "execute", "DB", "--local", "--config", configPath, "--persist-to", statePath, "--json", "--command", sql]);
  return JSON.parse(output)[0]?.results ?? [];
}

function execute(sql, statePath, configPath = defaultConfig) {
  return runWrangler([wrangler, "d1", "execute", "DB", "--local", "--config", configPath, "--persist-to", statePath, "--command", sql]);
}

function applyMigrations(statePath, configPath = defaultConfig) {
  return runWrangler([wrangler, "d1", "migrations", "apply", "DB", "--local", "--config", configPath, "--persist-to", statePath]);
}

function migrationNames(statePath, configPath = defaultConfig) {
  return query("SELECT name FROM d1_migrations ORDER BY id", statePath, configPath).map((row) => row.name);
}

async function prepareMigrationConfig(migrationsPath, configPath, maxMigration) {
  await fs.mkdir(migrationsPath, { recursive: true });
  const migrationFiles = (await fs.readdir(path.resolve(root, "drizzle")))
    .filter((file) => /^\d{4}_.+\.sql$/.test(file) && Number(file.slice(0, 4)) <= maxMigration)
    .sort();
  for (const file of migrationFiles) await fs.copyFile(path.resolve(root, "drizzle", file), path.resolve(migrationsPath, file));
  const config = {
    $schema: "node_modules/wrangler/config-schema.json",
    name: path.basename(configPath, ".json"),
    main: "worker/index.ts",
    compatibility_date: "2026-08-04",
    compatibility_flags: ["nodejs_compat"],
    d1_databases: [{
      binding: "DB",
      database_name: "qianlin-travel-d1",
      database_id: "00000000-0000-4000-8000-000000000000",
      migrations_dir: path.relative(path.dirname(configPath), migrationsPath).replaceAll("\\", "/"),
    }],
  };
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}

async function main() {
  await fs.rm(freshState, { recursive: true, force: true });
  await fs.rm(legacyState, { recursive: true, force: true });
  await fs.rm(legacyMigrations, { recursive: true, force: true });
  await fs.rm(legacyConfig, { force: true });
  await fs.rm(mismatchState, { recursive: true, force: true });
  await fs.rm(mismatchMigrations, { recursive: true, force: true });
  await fs.rm(mismatchConfig, { force: true });
  try {
    applyMigrations(freshState);
    assert.deepEqual(migrationNames(freshState), [
      "0000_tired_pride.sql",
      "0001_romantic_roland_deschain.sql",
      "0002_tranquil_polaris.sql",
      "0003_early_bedlam.sql",
      "0004_numerous_captain_flint.sql",
      "0005_local_profile_images.sql",
      "0006_breezy_blink.sql",
      "0007_yielding_deathstrike.sql",
      "0008_saas_identity_and_tenant_governance.sql",
      "0009_tenant_inquiry_sync_jobs.sql",
      "0010_add_tenant_province_catalog.sql",
      "0011_small_triton.sql",
      "0012_dead_letter_status.sql",
    ]);

    const counts = query("SELECT (SELECT COUNT(*) FROM tenants WHERE status = 'active') AS active_tenants, (SELECT COUNT(*) FROM tenants WHERE site_status = 'published' AND id = 'qianlin-travel') AS qianlin_published, (SELECT COUNT(*) FROM tenants WHERE site_status = 'published' AND id = 'yunnan-demo') AS demo_published, (SELECT COUNT(*) FROM tenant_hero_slides WHERE tenant_id = 'qianlin-travel' AND status = 'published') AS qianlin_heroes, (SELECT COUNT(*) FROM tenant_hero_slides WHERE tenant_id = 'yunnan-demo' AND status = 'published') AS demo_heroes, (SELECT COUNT(*) FROM planner_cities WHERE tenant_id = 'qianlin-travel' AND status = 'published') AS qianlin_cities, (SELECT COUNT(*) FROM planner_destinations WHERE tenant_id = 'qianlin-travel' AND status = 'published') AS qianlin_destinations, (SELECT COUNT(*) FROM tenant_tours WHERE tenant_id = 'qianlin-travel') AS qianlin_tours, (SELECT COUNT(*) FROM tenant_tours WHERE tenant_id = 'yunnan-demo') AS demo_tours, (SELECT COUNT(*) FROM inquiries WHERE tenant_id IS NULL) AS null_inquiries", freshState);
    const countRow = counts[0];
    assert.equal(countRow.active_tenants, 2);
    assert.equal(countRow.qianlin_published, 1);
    assert.equal(countRow.demo_published, 1);
    assert.equal(countRow.qianlin_heroes, 2);
    assert.equal(countRow.demo_heroes, 0);
    assert.equal(countRow.qianlin_cities, 9);
    assert.equal(countRow.qianlin_destinations, 16);
    assert.equal(countRow.qianlin_tours, 0);
    assert.equal(countRow.demo_tours, 0);
    assert.equal(countRow.null_inquiries, 0);
    assert.equal(query("SELECT COUNT(*) AS count FROM tenant_legal_pages WHERE tenant_id IN ('qianlin-travel', 'yunnan-demo')", freshState)[0].count, 2);
    assert.equal(query("SELECT COUNT(*) AS count FROM tenant_quotas WHERE tenant_id IN ('qianlin-travel', 'yunnan-demo')", freshState)[0].count, 2);
    assert.equal(query("SELECT COUNT(*) AS count FROM users", freshState)[0].count, 0);
    assert.equal(query("SELECT COUNT(*) AS count FROM tenant_memberships", freshState)[0].count, 0);
    assert.equal(query("SELECT COUNT(*) AS count FROM sessions", freshState)[0].count, 0);
    assert.equal(query("SELECT COUNT(*) AS count FROM admin_audit_logs", freshState)[0].count, 0);
    assert.equal(query("SELECT COUNT(*) AS count FROM tenants WHERE id = 'default' OR slug = 'default' OR slug = 'qianlin' ", freshState)[0].count, 0);

    const inquiryColumns = query("SELECT name, dflt_value FROM pragma_table_info('inquiries') WHERE name = 'tenant_id'", freshState)[0];
    assert.equal(inquiryColumns.dflt_value, null);
    assert.ok(query("PRAGMA foreign_key_list('inquiries')", freshState).some((row) => row.table === "tenants" && row.on_delete.toUpperCase() === "RESTRICT"));
    assert.equal(query("PRAGMA foreign_key_check", freshState).length, 0);
    assert.ok(query("SELECT name FROM pragma_index_list('inquiries')", freshState).some((row) => row.name === "uq_inquiries_tenant_id_id"));
    assert.ok(query("PRAGMA foreign_key_list('tenant_inquiry_sync_jobs')", freshState).some((row) => row.table === "inquiries" && row.from === "tenant_id"));
    assert.equal(query("SELECT COUNT(*) AS count FROM inquiries i LEFT JOIN tenants t ON t.id = i.tenant_id WHERE t.id IS NULL", freshState)[0].count, 0);
    assert.ok(query("PRAGMA foreign_key_list('tenant_tours')", freshState).some((row) => row.table === "tenants" && row.on_delete.toUpperCase() === "RESTRICT"));
    assert.equal(query("SELECT dflt_value FROM pragma_table_info('tenant_tours') WHERE name = 'tenant_id'", freshState)[0].dflt_value, null);
    assert.ok(query("SELECT name FROM pragma_index_list('tenant_tours')", freshState).some((row) => row.name === "uq_tenant_tours_tenant_slug"));
    assert.equal(query("PRAGMA foreign_key_check", freshState).length, 0);

    assert.throws(() => execute("INSERT INTO inquiries (tenant_id, name, phone, travelers, privacy_consent) VALUES ('missing-tenant', 'Test', '18900000000', '1', 1)", freshState));
    execute("INSERT INTO inquiries (tenant_id, name, phone, travelers, privacy_consent, status) VALUES ('qianlin-travel', 'Status test', '18900000000', '1', 1, 'following_up')", freshState);
    assert.equal(query("SELECT status FROM inquiries WHERE name = 'Status test'", freshState)[0].status, "following_up");
    assert.throws(() => execute("INSERT INTO inquiries (tenant_id, name, phone, travelers, privacy_consent, status) VALUES ('qianlin-travel', 'Invalid status test', '18900000000', '1', 1, 'invalid')", freshState));
    execute("INSERT INTO tenants (id, slug, name_zh, name_en, status, site_status, default_language, is_demo) VALUES ('configuring-test', 'configuring-test', 'Configuring test', 'Configuring test', 'active', 'configuring', 'en', 0)", freshState);
    execute("INSERT INTO inquiries (tenant_id, name, phone, travelers, privacy_consent) VALUES ('yunnan-demo', 'Tenant test', '18900000000', '1', 1)", freshState);
    assert.equal(query("SELECT COUNT(*) AS count FROM inquiries WHERE tenant_id = 'yunnan-demo'", freshState)[0].count, 1);
    execute("INSERT INTO inquiries (tenant_id, name, phone, travelers, privacy_consent) VALUES ('qianlin-travel', 'Sync tenant test', '18900000000', '1', 1)", freshState);
    const qianlinSyncInquiryId = query("SELECT id FROM inquiries WHERE name = 'Sync tenant test'", freshState)[0].id;
    execute(`INSERT INTO tenant_inquiry_sync_jobs (id, tenant_id, inquiry_id, provider, idempotency_key) VALUES ('disabled-sync-job', 'qianlin-travel', ${qianlinSyncInquiryId}, 'disabled', 'qianlin-travel:inquiry:${qianlinSyncInquiryId}:provider:disabled')`, freshState);
    execute(`INSERT INTO tenant_inquiry_sync_jobs (id, tenant_id, inquiry_id, provider, idempotency_key) VALUES ('mock-sync-job', 'qianlin-travel', ${qianlinSyncInquiryId}, 'mock', 'qianlin-travel:inquiry:${qianlinSyncInquiryId}:provider:mock')`, freshState);
    assert.throws(() => execute(`INSERT INTO tenant_inquiry_sync_jobs (id, tenant_id, inquiry_id, provider, idempotency_key) VALUES ('mock-sync-duplicate', 'qianlin-travel', ${qianlinSyncInquiryId}, 'mock', 'qianlin-travel:inquiry:${qianlinSyncInquiryId}:provider:mock-duplicate')`, freshState));
    assert.throws(() => execute(`INSERT INTO tenant_inquiry_sync_jobs (id, tenant_id, inquiry_id, provider, idempotency_key) VALUES ('cross-tenant-job', 'yunnan-demo', ${qianlinSyncInquiryId}, 'disabled', 'yunnan-demo:inquiry:${qianlinSyncInquiryId}:provider:disabled')`, freshState));
    // 0012 migration must allow 'dead_letter' as a status while still rejecting
    // any unknown status value via the extended CHECK constraint.
    execute(`INSERT INTO tenant_inquiry_sync_jobs (id, tenant_id, inquiry_id, provider, status, idempotency_key) VALUES ('dead-letter-sync-job', 'qianlin-travel', ${qianlinSyncInquiryId}, 'zhilv', 'dead_letter', 'qianlin-travel:inquiry:${qianlinSyncInquiryId}:provider:zhilv:dead-letter')`, freshState);
    assert.equal(query("SELECT status FROM tenant_inquiry_sync_jobs WHERE id = 'dead-letter-sync-job'", freshState)[0].status, "dead_letter");
    assert.throws(() => execute(`INSERT INTO tenant_inquiry_sync_jobs (id, tenant_id, inquiry_id, provider, status, idempotency_key) VALUES ('invalid-status-sync-job', 'qianlin-travel', ${qianlinSyncInquiryId}, 'zhilv', 'invalid_dead', 'qianlin-travel:inquiry:${qianlinSyncInquiryId}:provider:zhilv:invalid')`, freshState));
    assert.equal(query("SELECT COUNT(*) AS count FROM tenant_inquiry_sync_jobs", freshState)[0].count, 3);
    assert.equal(query("PRAGMA foreign_key_check", freshState).length, 0);
    assert.equal(query("SELECT status, site_status, default_language FROM tenants WHERE id = 'configuring-test'", freshState)[0].site_status, "configuring");
    const tourInsert = "('qianlin-tour-test','qianlin-travel','shared-slug','测试线路','Test tour','测试线路介绍','Test tour description','5天4晚','5 Days 4 Nights','','','价格请咨询','Contact us for price','/images/guizhou/huangguoshu.png','测试图片','Test image',1,10,'published')";
    execute(`INSERT INTO tenant_tours (id, tenant_id, slug, title_zh, title_en, description_zh, description_en, duration_zh, duration_en, tag_zh, tag_en, price_text_zh, price_text_en, image_url, image_alt_zh, image_alt_en, featured, display_order, status) VALUES ${tourInsert}`, freshState);
    execute("INSERT INTO tenant_tours (id, tenant_id, slug, title_zh, title_en, description_zh, description_en, featured, display_order, status) VALUES ('yunnan-tour-test','yunnan-demo','shared-slug','云南测试线路','Yunnan test tour','云南测试介绍','Yunnan test description',0,20,'draft')", freshState);
    assert.throws(() => execute("INSERT INTO tenant_tours (id, tenant_id, slug, title_zh, title_en, description_zh, description_en, featured, display_order, status) VALUES ('qianlin-tour-duplicate','qianlin-travel','shared-slug','重复线路','Duplicate tour','重复介绍','Duplicate description',0,20,'draft')", freshState));
    assert.throws(() => execute("INSERT INTO tenant_tours (id, tenant_id, slug, title_zh, title_en, description_zh, description_en, featured, display_order, status) VALUES ('invalid-tour-status','qianlin-travel','invalid-status','状态测试','Status test','介绍','Description',0,20,'invalid')", freshState));
    assert.throws(() => execute("INSERT INTO tenant_tours (id, tenant_id, slug, title_zh, title_en, description_zh, description_en, featured, display_order, status) VALUES ('invalid-tour-featured','qianlin-travel','invalid-featured','推荐测试','Featured test','介绍','Description',2,20,'draft')", freshState));
    assert.throws(() => execute("INSERT INTO tenant_tours (id, tenant_id, slug, title_zh, title_en, description_zh, description_en, featured, display_order, status) VALUES ('invalid-tour-order','qianlin-travel','invalid-order','顺序测试','Order test','介绍','Description',0,1.5,'draft')", freshState));
    assert.equal(query("SELECT COUNT(*) AS count FROM tenant_tours WHERE tenant_id = 'qianlin-travel'", freshState)[0].count, 1);
    assert.equal(query("SELECT COUNT(*) AS count FROM tenant_tours WHERE tenant_id = 'yunnan-demo'", freshState)[0].count, 1);

    await prepareMigrationConfig(legacyMigrations, legacyConfig, 4);
    applyMigrations(legacyState, legacyConfig);
    assert.deepEqual(migrationNames(legacyState, legacyConfig), [
      "0000_tired_pride.sql",
      "0001_romantic_roland_deschain.sql",
      "0002_tranquil_polaris.sql",
      "0003_early_bedlam.sql",
      "0004_numerous_captain_flint.sql",
    ]);
    assert.equal(query("SELECT customize_image_url FROM tenant_site_profiles WHERE tenant_id = 'qianlin-travel'", legacyState, legacyConfig)[0].customize_image_url, "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1400&q=85");

    applyMigrations(legacyState);
    assert.deepEqual(migrationNames(legacyState), [
      "0000_tired_pride.sql",
      "0001_romantic_roland_deschain.sql",
      "0002_tranquil_polaris.sql",
      "0003_early_bedlam.sql",
      "0004_numerous_captain_flint.sql",
      "0005_local_profile_images.sql",
      "0006_breezy_blink.sql",
      "0007_yielding_deathstrike.sql",
      "0008_saas_identity_and_tenant_governance.sql",
      "0009_tenant_inquiry_sync_jobs.sql",
      "0010_add_tenant_province_catalog.sql",
      "0011_small_triton.sql",
      "0012_dead_letter_status.sql",
    ]);
    assert.equal(query("SELECT customize_image_url FROM tenant_site_profiles WHERE tenant_id = 'qianlin-travel'", legacyState)[0].customize_image_url, "/images/guizhou/customize-mountains.png");
    assert.equal(query("SELECT COUNT(*) AS count FROM tenant_tours", legacyState)[0].count, 0);
    assert.equal(query("PRAGMA foreign_key_check", legacyState).length, 0);

    await prepareMigrationConfig(mismatchMigrations, mismatchConfig, 10);
    applyMigrations(mismatchState, mismatchConfig);
    execute("INSERT INTO inquiries (tenant_id, name, phone, travelers, privacy_consent) VALUES ('qianlin-travel', 'Migration mismatch test', '18900000000', '1', 1)", mismatchState, mismatchConfig);
    const mismatchedInquiryId = query("SELECT id FROM inquiries WHERE name = 'Migration mismatch test'", mismatchState, mismatchConfig)[0].id;
    assert.doesNotThrow(() => execute(`INSERT INTO tenant_inquiry_sync_jobs (id, tenant_id, inquiry_id, idempotency_key) VALUES ('historical-mismatch-job', 'yunnan-demo', ${mismatchedInquiryId}, 'historical-mismatch')`, mismatchState, mismatchConfig));
    assert.throws(() => applyMigrations(mismatchState));
    assert.equal(query("SELECT COUNT(*) AS count FROM d1_migrations WHERE name = '0011_small_triton.sql'", mismatchState)[0].count, 0);
    assert.equal(query("SELECT COUNT(*) AS count FROM tenant_inquiry_sync_jobs", mismatchState, mismatchConfig)[0].count, 1);
    console.log("Historical sync-job tenant mismatch was detected and migration was refused without overwriting data.");

    // Retention (anonymization) tests live in scripts/test-local-retention.ts,
    // which drives a live D1 instance through the real
    // anonymizeExpiredInquiries() implementation (see test:integration:local).

    console.log("Local D1 integration passed: fresh 0000-0012 and existing 0000-0004 plus 0005-0012 migration paths.");
  } finally {
    await fs.rm(freshState, { recursive: true, force: true });
    await fs.rm(legacyState, { recursive: true, force: true });
    await fs.rm(legacyMigrations, { recursive: true, force: true });
    await fs.rm(legacyConfig, { force: true });
    await fs.rm(mismatchState, { recursive: true, force: true });
    await fs.rm(mismatchMigrations, { recursive: true, force: true });
    await fs.rm(mismatchConfig, { force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
