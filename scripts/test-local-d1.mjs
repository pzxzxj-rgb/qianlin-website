import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testState = path.resolve(root, ".wrangler", "test-state");
const wrangler = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const baseArgs = [wrangler, "d1", "execute", "DB", "--local", "--config", "wrangler.local.jsonc", "--persist-to", ".wrangler/test-state", "--json"];

function runWrangler(args) {
  return execFileSync(process.execPath, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function query(sql) {
  const output = runWrangler([...baseArgs, "--command", sql]);
  return JSON.parse(output)[0]?.results ?? [];
}

function execute(sql) {
  return runWrangler([...baseArgs, "--command", sql]);
}

async function main() {
  await fs.rm(testState, { recursive: true, force: true });
  try {
    runWrangler([wrangler, "d1", "migrations", "apply", "DB", "--local", "--config", "wrangler.local.jsonc", "--persist-to", ".wrangler/test-state"]);

    const counts = query("SELECT (SELECT COUNT(*) FROM tenants WHERE status = 'active') AS active_tenants, (SELECT COUNT(*) FROM tenants WHERE site_status = 'published' AND id = 'qianlin-travel') AS qianlin_published, (SELECT COUNT(*) FROM tenants WHERE site_status = 'published' AND id = 'yunnan-demo') AS demo_published, (SELECT COUNT(*) FROM tenant_hero_slides WHERE tenant_id = 'qianlin-travel' AND status = 'published') AS qianlin_heroes, (SELECT COUNT(*) FROM tenant_hero_slides WHERE tenant_id = 'yunnan-demo' AND status = 'published') AS demo_heroes, (SELECT COUNT(*) FROM planner_cities WHERE tenant_id = 'qianlin-travel' AND status = 'published') AS qianlin_cities, (SELECT COUNT(*) FROM planner_destinations WHERE tenant_id = 'qianlin-travel' AND status = 'published') AS qianlin_destinations, (SELECT COUNT(*) FROM inquiries WHERE tenant_id IS NULL) AS null_inquiries");
    const countRow = counts[0];
    assert.equal(countRow.active_tenants, 2);
    assert.equal(countRow.qianlin_published, 1);
    assert.equal(countRow.demo_published, 1);
    assert.equal(countRow.qianlin_heroes, 2);
    assert.equal(countRow.demo_heroes, 0);
    assert.equal(countRow.qianlin_cities, 9);
    assert.equal(countRow.qianlin_destinations, 16);
    assert.equal(countRow.null_inquiries, 0);
    assert.equal(query("SELECT COUNT(*) AS count FROM tenants WHERE id = 'default' OR slug = 'default' OR slug = 'qianlin' ")[0].count, 0);

    const inquiryColumns = query("SELECT name, dflt_value FROM pragma_table_info('inquiries') WHERE name = 'tenant_id'")[0];
    assert.equal(inquiryColumns.dflt_value, null);
    assert.ok(query("PRAGMA foreign_key_list('inquiries')").some((row) => row.table === "tenants" && row.on_delete.toUpperCase() === "RESTRICT"));
    assert.equal(query("PRAGMA foreign_key_check").length, 0);
    assert.equal(query("SELECT COUNT(*) AS count FROM inquiries i LEFT JOIN tenants t ON t.id = i.tenant_id WHERE t.id IS NULL")[0].count, 0);

    assert.throws(() => execute("INSERT INTO inquiries (tenant_id, name, phone, travelers, privacy_consent) VALUES ('missing-tenant', 'Test', '18900000000', '1', 1)"));
    execute("INSERT INTO tenants (id, slug, name_zh, name_en, status, site_status, default_language, is_demo) VALUES ('configuring-test', 'configuring-test', '配置测试', 'Configuring test', 'active', 'configuring', 'en', 0)");
    execute("INSERT INTO inquiries (tenant_id, name, phone, travelers, privacy_consent) VALUES ('yunnan-demo', 'Tenant test', '18900000000', '1', 1)");
    assert.equal(query("SELECT COUNT(*) AS count FROM inquiries WHERE tenant_id = 'yunnan-demo'")[0].count, 1);
    assert.equal(query("SELECT status, site_status, default_language FROM tenants WHERE id = 'configuring-test'")[0].site_status, "configuring");

    console.log("Local D1 integration passed: migrations, tenant constraints, isolation counts, status defaults, and inquiry foreign-key behavior.");
  } finally {
    await fs.rm(testState, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
