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

async function prepareLegacyMigrationConfig() {
  await fs.mkdir(legacyMigrations, { recursive: true });
  const migrationFiles = (await fs.readdir(path.resolve(root, "drizzle")))
    .filter((file) => /^\d{4}_.+\.sql$/.test(file) && Number(file.slice(0, 4)) <= 4)
    .sort();
  for (const file of migrationFiles) {
    await fs.copyFile(path.resolve(root, "drizzle", file), path.resolve(legacyMigrations, file));
  }
  const config = {
    $schema: "node_modules/wrangler/config-schema.json",
    name: "qianlin-travel-legacy-migration-test",
    main: "worker/index.ts",
    compatibility_date: "2026-08-04",
    compatibility_flags: ["nodejs_compat"],
    d1_databases: [{
      binding: "DB",
      database_name: "qianlin-travel-d1",
      database_id: "00000000-0000-4000-8000-000000000000",
      migrations_dir: path.relative(path.dirname(legacyConfig), legacyMigrations).replaceAll("\\", "/"),
    }],
  };
  await fs.writeFile(legacyConfig, JSON.stringify(config, null, 2));
}

async function main() {
  await fs.rm(freshState, { recursive: true, force: true });
  await fs.rm(legacyState, { recursive: true, force: true });
  await fs.rm(legacyMigrations, { recursive: true, force: true });
  await fs.rm(legacyConfig, { force: true });
  try {
    applyMigrations(freshState);
    assert.deepEqual(migrationNames(freshState), [
      "0000_tired_pride.sql",
      "0001_romantic_roland_deschain.sql",
      "0002_tranquil_polaris.sql",
      "0003_early_bedlam.sql",
      "0004_numerous_captain_flint.sql",
      "0005_local_profile_images.sql",
    ]);

    const counts = query("SELECT (SELECT COUNT(*) FROM tenants WHERE status = 'active') AS active_tenants, (SELECT COUNT(*) FROM tenants WHERE site_status = 'published' AND id = 'qianlin-travel') AS qianlin_published, (SELECT COUNT(*) FROM tenants WHERE site_status = 'published' AND id = 'yunnan-demo') AS demo_published, (SELECT COUNT(*) FROM tenant_hero_slides WHERE tenant_id = 'qianlin-travel' AND status = 'published') AS qianlin_heroes, (SELECT COUNT(*) FROM tenant_hero_slides WHERE tenant_id = 'yunnan-demo' AND status = 'published') AS demo_heroes, (SELECT COUNT(*) FROM planner_cities WHERE tenant_id = 'qianlin-travel' AND status = 'published') AS qianlin_cities, (SELECT COUNT(*) FROM planner_destinations WHERE tenant_id = 'qianlin-travel' AND status = 'published') AS qianlin_destinations, (SELECT COUNT(*) FROM inquiries WHERE tenant_id IS NULL) AS null_inquiries", freshState);
    const countRow = counts[0];
    assert.equal(countRow.active_tenants, 2);
    assert.equal(countRow.qianlin_published, 1);
    assert.equal(countRow.demo_published, 1);
    assert.equal(countRow.qianlin_heroes, 2);
    assert.equal(countRow.demo_heroes, 0);
    assert.equal(countRow.qianlin_cities, 9);
    assert.equal(countRow.qianlin_destinations, 16);
    assert.equal(countRow.null_inquiries, 0);
    assert.equal(query("SELECT COUNT(*) AS count FROM tenants WHERE id = 'default' OR slug = 'default' OR slug = 'qianlin' ", freshState)[0].count, 0);

    const inquiryColumns = query("SELECT name, dflt_value FROM pragma_table_info('inquiries') WHERE name = 'tenant_id'", freshState)[0];
    assert.equal(inquiryColumns.dflt_value, null);
    assert.ok(query("PRAGMA foreign_key_list('inquiries')", freshState).some((row) => row.table === "tenants" && row.on_delete.toUpperCase() === "RESTRICT"));
    assert.equal(query("PRAGMA foreign_key_check", freshState).length, 0);
    assert.equal(query("SELECT COUNT(*) AS count FROM inquiries i LEFT JOIN tenants t ON t.id = i.tenant_id WHERE t.id IS NULL", freshState)[0].count, 0);

    assert.throws(() => execute("INSERT INTO inquiries (tenant_id, name, phone, travelers, privacy_consent) VALUES ('missing-tenant', 'Test', '18900000000', '1', 1)", freshState));
    execute("INSERT INTO tenants (id, slug, name_zh, name_en, status, site_status, default_language, is_demo) VALUES ('configuring-test', 'configuring-test', 'Configuring test', 'Configuring test', 'active', 'configuring', 'en', 0)", freshState);
    execute("INSERT INTO inquiries (tenant_id, name, phone, travelers, privacy_consent) VALUES ('yunnan-demo', 'Tenant test', '18900000000', '1', 1)", freshState);
    assert.equal(query("SELECT COUNT(*) AS count FROM inquiries WHERE tenant_id = 'yunnan-demo'", freshState)[0].count, 1);
    assert.equal(query("SELECT status, site_status, default_language FROM tenants WHERE id = 'configuring-test'", freshState)[0].site_status, "configuring");

    await prepareLegacyMigrationConfig();
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
    ]);
    assert.equal(query("SELECT customize_image_url FROM tenant_site_profiles WHERE tenant_id = 'qianlin-travel'", legacyState)[0].customize_image_url, "/images/guizhou/customize-mountains.png");

    console.log("Local D1 integration passed: fresh 0000-0005 and existing 0000-0004 plus 0005 migration paths.");
  } finally {
    await fs.rm(freshState, { recursive: true, force: true });
    await fs.rm(legacyState, { recursive: true, force: true });
    await fs.rm(legacyMigrations, { recursive: true, force: true });
    await fs.rm(legacyConfig, { force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
