import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readSource = (relativePath) => fs.readFile(path.join(projectRoot, relativePath), "utf8");
const [schemaSource, migrationSource, routeSource, optionsSource, plannerSource, destinationsSource, translationsSource] = await Promise.all([
  readSource("db/schema.ts"),
  readSource("drizzle/0002_tranquil_polaris.sql"),
  readSource("app/api/planner/options/route.ts"),
  readSource("lib/planner/getOptionsForTenant.ts"),
  readSource("components/ItineraryPlanner.tsx"),
  readSource("components/Destinations.tsx"),
  readSource("data/translations.ts"),
]);

const cityIds = [
  "qianlin-guiyang", "qianlin-zunyi", "qianlin-liupanshui", "qianlin-anshun", "qianlin-bijie",
  "qianlin-tongren", "qianlin-qiandongnan", "qianlin-qiannan", "qianlin-qianxinan",
];

const destinationIds = [
  "qingyan-ancient-town", "jiaxiu-pavilion", "zunyi-conference-site", "chishui-danxia", "wumeng-grassland",
  "huangguoshu-waterfall", "longgong-scenic-area", "baili-rhododendron", "zhijin-cave", "fanjing-mountain",
  "xijiang-miao-village", "zhenyuan-ancient-town", "libo-xiaoqikong", "china-sky-eye-fast", "wanfenglin", "malinghe-canyon",
];

test("defines the province hierarchy and migration-safe planner fields", () => {
  assert.match(schemaSource, /plannerProvinces = sqliteTable\("planner_provinces"/);
  assert.match(schemaSource, /provinceCode: text\("province_code"\)/g);
  assert.match(migrationSource, /CREATE TABLE .*planner_provinces/);
  assert.match(migrationSource, /INSERT OR IGNORE INTO .*planner_provinces/);
  assert.match(migrationSource, /'guizhou','guizhou','贵州省','Guizhou'/);
});

test("seeds exactly the requested Guizhou cities and destinations", () => {
  assert.equal(new Set(cityIds).size, 9);
  assert.equal(new Set(destinationIds).size, 16);
  for (const id of cityIds) assert.match(migrationSource, new RegExp("'" + id + "'"));
  for (const id of destinationIds) assert.match(migrationSource, new RegExp("'" + id + "'"));
  assert.match(migrationSource, /UPDATE .*planner_cities.*status.*archived.*code.*kaili/s);
  assert.match(migrationSource, /'xijiang-miao-village'.*'qiandongnan'/s);
  assert.match(migrationSource, /'libo-xiaoqikong'.*'qiannan'/s);
});

test("keeps unverified new images out of the homepage", () => {
  for (const id of [
    "qingyan-ancient-town", "jiaxiu-pavilion", "zunyi-conference-site", "chishui-danxia", "wumeng-grassland",
    "longgong-scenic-area", "baili-rhododendron", "zhijin-cave", "zhenyuan-ancient-town", "china-sky-eye-fast",
    "wanfenglin", "malinghe-canyon",
  ]) {
    const row = migrationSource.split("\n").find((line) => line.includes("'" + id + "'"));
    assert.ok(row, id);
    assert.match(row, /,'','','small',/);
    assert.match(row, /,0,1,0,\d+,'published'[),]/);
  }
  assert.match(destinationsSource, /showOnHomepage && destination\.imageUrl\.trim\(\)\.length > 0/);
});

test("keeps the API and planner fully dynamic", () => {
  assert.match(routeSource, /getDefaultTenant/);
  assert.match(optionsSource, /plannerProvinces/);
  assert.match(optionsSource, /provinceCode/);
  assert.match(optionsSource, /Boolean\(destination\.availableForPlanning\)/);
  assert.doesNotMatch(plannerSource, /data\/destinations|t\.planner\.cities/);
  assert.doesNotMatch(plannerSource, /destinations\s*=\s*\[/);
  assert.doesNotMatch(plannerSource, /useState\(["']Guiyang["']\)/);
  assert.match(plannerSource, /guiyang/);
  assert.match(translationsSource, /出发城市\/地区/);
  assert.match(translationsSource, /结束城市\/地区/);
  assert.match(translationsSource, /最短路线或实时最优路线/);
});
