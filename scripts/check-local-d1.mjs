import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = process.execPath;
const wranglerEntrypoint = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const commonArgs = [wranglerEntrypoint, "d1", "execute", "DB", "--local", "--config", "wrangler.local.jsonc", "--persist-to", ".wrangler/state", "--json"];

function query(sql) {
  try {
    const output = execFileSync(wrangler, [...commonArgs, "--command", sql], { cwd: root, encoding: "utf8" });
    const payload = JSON.parse(output);
    return payload[0]?.results ?? [];
  } catch (error) {
    const message = error?.stderr?.toString().trim() || error?.message || "Unknown local D1 error";
    console.error("Local D1 check failed: " + message);
    process.exit(1);
  }
}

const expectedTables = ["tenants", "tenant_site_profiles", "tenant_contact_channels", "tenant_hero_slides", "inquiries", "planner_provinces", "planner_cities", "planner_destinations"];
const tables = new Set(query("SELECT name FROM sqlite_master WHERE type = 'table'").map((row) => row.name));
const missingTables = expectedTables.filter((table) => !tables.has(table));
if (missingTables.length > 0) {
  console.error("Local D1 missing tables: " + missingTables.join(", "));
  console.error("Run npm run db:migrate:local first.");
  process.exit(1);
}

const counts = query("SELECT (SELECT COUNT(*) FROM tenants WHERE status = 'active') AS active_tenant_count, (SELECT COUNT(*) FROM tenants WHERE slug = 'yunnan-demo' AND is_demo = 1) AS demo_tenant_count, (SELECT COUNT(*) FROM tenant_site_profiles WHERE tenant_id = 'qianlin-travel' AND status = 'published') AS qianlin_profile_count, (SELECT COUNT(*) FROM tenant_site_profiles WHERE tenant_id = 'yunnan-demo' AND status = 'published') AS demo_profile_count, (SELECT COUNT(*) FROM tenant_contact_channels WHERE tenant_id = 'qianlin-travel' AND status = 'published') AS qianlin_contact_count, (SELECT COUNT(*) FROM tenant_hero_slides WHERE tenant_id = 'qianlin-travel' AND status = 'published') AS qianlin_hero_count, (SELECT COUNT(*) FROM tenant_hero_slides WHERE tenant_id = 'yunnan-demo' AND status = 'published') AS demo_hero_count, (SELECT COUNT(*) FROM planner_provinces WHERE status = 'published') AS province_count, (SELECT COUNT(*) FROM planner_cities WHERE tenant_id = 'qianlin-travel' AND status = 'published') AS city_count, (SELECT COUNT(*) FROM planner_destinations WHERE tenant_id = 'qianlin-travel' AND status = 'published') AS destination_count, (SELECT COUNT(*) FROM inquiries WHERE tenant_id = 'qianlin-travel') AS qianlin_inquiry_count");
const row = counts[0] ?? {};
console.log("Local D1 check (local development only)");
console.log("active tenants: " + row.active_tenant_count + "; yunnan-demo demo tenants: " + row.demo_tenant_count);
console.log("qianlin profiles: " + row.qianlin_profile_count + "; yunnan-demo profiles: " + row.demo_profile_count);
console.log("qianlin contacts: " + row.qianlin_contact_count + "; qianlin hero slides: " + row.qianlin_hero_count + "; yunnan-demo hero slides: " + row.demo_hero_count);
console.log("published provinces: " + row.province_count);
console.log("published qianlin cities: " + row.city_count);
console.log("published qianlin destinations: " + row.destination_count);
console.log("qianlin inquiries: " + row.qianlin_inquiry_count + "; inquiries table: " + (tables.has("inquiries") ? "present" : "missing"));
