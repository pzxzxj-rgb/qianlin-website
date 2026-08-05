import { rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.resolve(root, ".wrangler", "state", "v3", "d1");
const relativeTarget = path.relative(root, target);
if (!relativeTarget || relativeTarget.startsWith("..") || path.isAbsolute(relativeTarget)) {
  throw new Error("Refusing to reset a path outside the project workspace.");
}

console.log("仅限本地开发，禁止用于线上数据库。");
console.log("正在清理：" + relativeTarget);
await rm(target, { recursive: true, force: true });

const wrangler = process.execPath;
const wranglerEntrypoint = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const result = spawnSync(wrangler, [wranglerEntrypoint, "d1", "migrations", "apply", "DB", "--local", "--config", "wrangler.local.jsonc", "--persist-to", ".wrangler/state"], { cwd: root, stdio: "inherit" });
process.exit(result.status ?? 1);
