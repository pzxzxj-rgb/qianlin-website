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
    console.error("本地 D1 检查失败：" + message);
    process.exit(1);
  }
}

const expectedTables = ["inquiries", "planner_provinces", "planner_cities", "planner_destinations"];
const tables = new Set(query("SELECT name FROM sqlite_master WHERE type = 'table'").map((row) => row.name));
const missingTables = expectedTables.filter((table) => !tables.has(table));
if (missingTables.length > 0) {
  console.error("本地 D1 缺少数据表：" + missingTables.join(", "));
  console.error("请先运行 npm run db:migrate:local。");
  process.exit(1);
}

const counts = query("SELECT (SELECT COUNT(*) FROM planner_provinces WHERE status = 'published') AS province_count, (SELECT COUNT(*) FROM planner_cities WHERE tenant_id = 'qianlin-travel' AND status = 'published') AS city_count, (SELECT COUNT(*) FROM planner_destinations WHERE tenant_id = 'qianlin-travel' AND status = 'published') AS destination_count");
const row = counts[0] ?? {};
console.log("本地 D1 检查结果（仅限本地开发）");
console.log("planner_provinces published：" + row.province_count);
console.log("planner_cities published：" + row.city_count);
console.log("planner_destinations published：" + row.destination_count);
console.log("inquiries 表：" + (tables.has("inquiries") ? "存在" : "不存在"));
