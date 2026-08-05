import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFile(path.join(projectRoot, file), "utf8");
const [schema, migration, route, options, planner, destinations, translations] = await Promise.all([
  read("db/schema.ts"),
  read("drizzle/0002_tranquil_polaris.sql"),
  read("app/api/planner/options/route.ts"),
  read("lib/planner/getOptionsForTenant.ts"),
  read("components/ItineraryPlanner.tsx"),
  read("components/Destinations.tsx"),
  read("data/translations.ts"),
]);

const cityIds = ["qianlin-guiyang", "qianlin-zunyi", "qianlin-liupanshui", "qianlin-anshun", "qianlin-bijie", "qianlin-tongren", "qianlin-qiandongnan", "qianlin-qiannan", "qianlin-qianxinan"];
const destinationIds = ["qingyan-ancient-town", "jiaxiu-pavilion", "zunyi-conference-site", "chishui-danxia", "wumeng-grassland", "huangguoshu-waterfall", "longgong-scenic-area", "baili-rhododendron", "zhijin-cave", "fanjing-mountain", "xijiang-miao-village", "zhenyuan-ancient-town", "libo-xiaoqikong", "china-sky-eye-fast", "wanfenglin", "malinghe-canyon"];

test("keeps the planner hierarchy and tenant filters", () => {
  assert.match(schema, /plannerProvinces = sqliteTable\("planner_provinces"/);
  assert.match(schema, /provinceCode: text\("province_code"\)/);
  assert.match(migration, /CREATE TABLE .*planner_provinces/);
  assert.match(migration, /INSERT OR IGNORE INTO .*planner_provinces/);
  assert.equal(new Set(cityIds).size, 9);
  assert.equal(new Set(destinationIds).size, 16);
  for (const id of cityIds) assert.match(migration, new RegExp("'" + id + "'"));
  for (const id of destinationIds) assert.match(migration, new RegExp("'" + id + "'"));
  assert.match(options, /tenantId: tenant\.id/);
  assert.match(options, /tenantSlug: tenant\.slug/);
  assert.match(route, /getDefaultTenant/);
  assert.match(planner, /usePlannerOptions/);
  assert.match(destinations, /homepageDestinations\.length/);
});

test("uses neutral planner copy and does not hardcode a region in UI translations", () => {
  assert.match(translations, /出发城市\/地区/);
  assert.match(translations, /结束城市\/地区/);
  assert.match(translations, /最短路线或实时最优路线/);
  assert.doesNotMatch(translations, /Qianlin|黔林|Guizhou|贵州/);
  assert.doesNotMatch(planner, /data\/destinations|planner\.cities/);
  assert.doesNotMatch(destinations, /data\/destinations/);
});
