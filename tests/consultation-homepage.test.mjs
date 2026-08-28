import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFile(path.join(projectRoot, file), "utf8");

test("keeps the travel preference to consultation prefill contract", async () => {
  const [preferences, home, customize] = await Promise.all([
    read("components/TravelPreferences.tsx"),
    read("components/TenantHomeClient.tsx"),
    read("components/CustomizeForm.tsx"),
  ]);

  assert.match(preferences, /onConsult/);
  assert.match(preferences, /map\(\(item\) => item\.label\)/);
  assert.match(preferences, /selectedLabels\.join/);
  assert.match(preferences, /onConsult\(/);
  assert.match(preferences, /data-testid="travel-preferences"/);
  assert.match(preferences, /data-testid="travel-preferences-consult"/);
  assert.match(home, /<TravelPreferences[\s\S]*onConsult=\{\(message\) =>[\s\S]*openCustomize\(\{ message \}\)/);
  assert.match(customize, /initialMessage/);
  assert.match(customize, /defaultValue=\{initialMessage\}/);
  assert.match(customize, /initialTourName\.trim\(\)\s*\|\|\s*initialMessage\.trim\(\)/);
  assert.match(customize, /setShowMoreFields\(true\)/);
});

test("keeps destinations visible when an image fails", async () => {
  const [destinations, styles] = await Promise.all([
    read("components/Destinations.tsx"),
    read("app/globals.css"),
  ]);

  assert.match(destinations, /const homepageDestinations = destinations\.filter\(\(destination\) => destination\.showOnHomepage\)/);
  assert.doesNotMatch(destinations, /homepageDestinations\s*=.*failedImageIds/);
  assert.match(destinations, /const imageAvailable =/);
  assert.match(destinations, /destination-image-fallback/);
  assert.match(destinations, /const markImageFailed =/);
  assert.match(destinations, /onError=\{\(\) => markImageFailed\(destination\.id\)\}/);
  assert.match(destinations, /homepageDestinations\.map/);
  assert.match(styles, /\.destination-image-fallback\s*\{/);
});

test("keeps stable Theme Studio preview selectors", async () => {
  const themeStudio = await read("components/AdminThemeStudio.tsx");
  assert.match(themeStudio, /data-testid="admin-theme-studio"/);
  assert.match(themeStudio, /data-testid="theme-preview"/);
});
