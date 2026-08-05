import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFile(path.join(projectRoot, relativePath), "utf8");

async function exists(relativePath) {
  try {
    await fs.access(path.join(projectRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

test("keeps the homepage free of the removed Gallery module and stale static site config", async () => {
  const page = await read("app/page.tsx");
  const translations = await read("data/translations.ts");
  const styles = await read("app/globals.css");
  assert.equal(await exists("components/Gallery.tsx"), false);
  assert.equal(await exists("data/siteConfig.ts"), false);
  assert.doesNotMatch(page, /Gallery|gallery/);
  assert.doesNotMatch(translations, /体验贵州|Experience Guizhou|贵州的六个片段|Guizhou in six frames|gallery/i);
  assert.doesNotMatch(styles, /section-gallery|gallery-grid|gallery-item/);
});

test("keeps the tenant homepage dynamic and configures language per tenant", async () => {
  const home = await read("components/TenantHomeClient.tsx");
  const language = await read("components/LanguageContext.tsx");
  const legal = await read("components/LegalPage.tsx");
  assert.match(home, /storageKey=\{`travel-language:\$\{tenantSlug\}`\}/);
  assert.match(home, /siteConfig\.profile\.primaryRegion/);
  assert.match(home, /siteConfig\.isConfigured/);
  assert.match(language, /initialLanguage/);
  assert.match(language, /storageKey/);
  assert.doesNotMatch(language, /qianlin-language/);
  assert.doesNotMatch(legal, /data\/siteConfig/);
});

test("keeps Hero controls accessible and motion-aware without static slide data", async () => {
  const hero = await read("components/Hero.tsx");
  const provider = await read("components/TenantSiteProvider.tsx");
  const plannerProvider = await read("components/PlannerOptionsProvider.tsx");
  assert.match(hero, /AUTO_ADVANCE_MS = 6000/);
  assert.match(hero, /role="group"/);
  assert.match(hero, /aria-current/);
  assert.match(hero, /prefers-reduced-motion/);
  assert.doesNotMatch(hero, /26.*N|106.*E/);
  assert.match(provider, /AbortController/);
  assert.match(provider, /value\.tenant\.slug !== tenantSlug/);
  assert.match(plannerProvider, /AbortController/);
  assert.match(plannerProvider, /value\.tenantSlug !== tenantSlug/);
});

test("sanitizes contact links and keeps the honeypot server check", async () => {
  const sanitizerSource = await read("lib/tenancy/sanitizeContactHref.ts");
  const formSource = await read("components/CustomizeForm.tsx");
  const inquirySource = await read("lib/inquiries/handleInquiry.ts");
  const output = ts.transpileModule(sanitizerSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const { sanitizeContactHref } = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
  assert.equal(sanitizeContactHref("javascript:alert(1)"), undefined);
  assert.equal(sanitizeContactHref("data:text/html,hello"), undefined);
  assert.equal(sanitizeContactHref("https://example.com/contact"), "https://example.com/contact");
  assert.equal(sanitizeContactHref("mailto:test@example.com"), "mailto:test@example.com");
  assert.equal(sanitizeContactHref("tel:+8613800000000"), "tel:+8613800000000");
  assert.match(formSource, /className="honeypot-field" aria-hidden="true"/);
  assert.match(inquirySource, /if \(website\)/);
  assert.match(inquirySource, /tenantId: tenant\.id/);
});

test("keeps generic copy, demo/configuring states and accurate documentation", async () => {
  const translations = await read("data/translations.ts");
  const home = await read("components/TenantHomeClient.tsx");
  const demoRoute = await read("app/api/t/[tenantSlug]/inquiries/route.ts");
  const readme = await read("README.md");
  assert.doesNotMatch(translations, /Qianlin|黔林|Guizhou|贵州/);
  assert.match(home, /siteConfig\.tenant\.isDemo/);
  assert.match(home, /!siteConfig\.isConfigured/);
  assert.match(demoRoute, /tenant\.isDemo \|\| tenant\.siteStatus !== "published"/);
  assert.match(readme, /Turnstile 目前尚未真正启用/);
  assert.match(readme, /独立的配置中页面/);
  assert.doesNotMatch(readme, /data\/siteConfig\.ts/);
});
