import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = process.execPath;
const entrypoint = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const limit = Math.min(Math.max(Number(process.env.INQUIRY_LIMIT || 50), 1), 200);
const sql = `SELECT id, tenant_id, status, created_at FROM inquiries ORDER BY id DESC LIMIT ${limit}`;
const args = [entrypoint, "d1", "execute", "DB", "--local", "--config", "wrangler.local.jsonc", "--persist-to", ".wrangler/state", "--json", "--command", sql];

try {
  const output = execFileSync(wrangler, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const rows = JSON.parse(output)[0]?.results ?? [];
  console.log(JSON.stringify(rows, null, 2));
  console.log("Only inquiry id, tenant_id, status, and created_at are shown.");
} catch (error) {
  const message = error?.stderr?.toString().trim() || error?.message || "Unknown local D1 error";
  console.error("Local inquiry query failed: " + message);
  process.exitCode = 1;
}
