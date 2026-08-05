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
  assert.doesNotMatch(translations, /Experience Guizhou|Guizhou in six frames|gallery/i);
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
  assert.match(hero, /onError/);
  assert.doesNotMatch(hero, /26.*N|106.*E/);
  assert.match(provider, /AbortController/);
  assert.match(provider, /value\.tenant\.slug !== tenantSlug/);
  assert.match(provider, /isRefreshing/);
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

test("documents the Mainland-only scope and production Turnstile requirements", async () => {
  const translations = await read("data/translations.ts");
  const home = await read("components/TenantHomeClient.tsx");
  const demoRoute = await read("app/api/t/[tenantSlug]/inquiries/route.ts");
  const readme = await read("README.md");
  assert.doesNotMatch(translations, /Qianlin|Guizhou/);
  assert.match(home, /siteConfig\.tenant\.isDemo/);
  assert.match(home, /!siteConfig\.isConfigured/);
  assert.match(demoRoute, /tenant\.isDemo \|\| tenant\.siteStatus !== "published"/);
  assert.match(readme, /当前版本先服务中国大陆用户/);
  assert.match(readme, /生产环境必须同时设置/);
  assert.match(readme, /当前没有咨询管理后台/);
  assert.doesNotMatch(readme, /data\/siteConfig\.ts/);
});

test("removes the legacy inquiry bypass and protects unpublished site config", async () => {
  const resolver = await read("lib/tenancy/resolveTenant.ts");
  const siteRoute = await read("app/api/t/[tenantSlug]/site-config/route.ts");
  const inquiryRoute = await read("app/api/t/[tenantSlug]/inquiries/route.ts");
  assert.equal(await exists("app/api/inquiries/route.ts"), false);
  assert.match(resolver, /function unconfiguredSiteConfig/);
  assert.match(resolver, /tenant\.siteStatus !== "published"/);
  assert.match(resolver, /contacts: \[\]/);
  assert.match(resolver, /heroSlides: \[\]/);
  assert.match(siteRoute, /no-store/);
  assert.match(inquiryRoute, /tenant\.isDemo \|\| tenant\.siteStatus !== "published"/);
});

test("keeps phone validation, Turnstile, duplicate protection, and safe local inquiry inspection", async () => {
  const phone = await read("lib/inquiries/validateMainlandPhone.ts");
  const handler = await read("lib/inquiries/handleInquiry.ts");
  const form = await read("components/CustomizeForm.tsx");
  const turnstile = await read("lib/security/turnstile.ts");
  const siteUrl = await read("lib/siteUrl.ts");
  const env = await read(".env.example");
  const script = await read("scripts/list-inquiries-local.mjs");
  assert.match(phone, /\^1\[3-9\]\\d\{9\}\$/);
  assert.match(handler, /normalizeMainlandPhone/);
  assert.match(handler, /isValidMainlandPhone/);
  assert.match(handler, /row\.name === values\.name/);
  assert.match(handler, /datetime\('now', '-10 minutes'\)/);
  assert.match(handler, /orderBy\(desc\(inquiries\.createdAt\)/);
  assert.match(handler, /相同咨询刚刚已经提交/);
  assert.match(form, /name="turnstileToken"/);
  assert.match(form, /TurnstileWidget/);
  assert.match(turnstile, /TURNSTILE_SECRET_KEY/);
  assert.match(turnstile, /challenges\.cloudflare\.com\/turnstile/);
  assert.match(siteUrl, /NEXT_PUBLIC_SITE_URL must be set/);
  assert.match(env, /TURNSTILE_SECRET_KEY=/);
  assert.doesNotMatch(env, /=\s*(sk_live|secret_[^\n]*)/i);
  assert.match(script, /SELECT id, tenant_id, status, created_at/);
  assert.doesNotMatch(script, /SELECT \* FROM inquiries/);
});

test("keeps the 3A admin shell read-only and fixed to qianlin-travel", async () => {
  const [adminPage, loginPage, loginRoute, logoutRoute, auth, dashboard, env] = await Promise.all([
    read("app/admin/page.tsx"),
    read("app/admin/login/page.tsx"),
    read("app/api/admin/login/route.ts"),
    read("app/api/admin/logout/route.ts"),
    read("lib/admin/auth.ts"),
    read("lib/admin/getAdminDashboard.ts"),
    read(".env.example"),
  ]);
  assert.match(adminPage, /getAdminSessionFromCookie/);
  assert.match(adminPage, /redirect\("\/admin\/login"\)/);
  assert.match(loginPage, /AdminLoginForm/);
  assert.match(loginRoute, /verifyAdminCredentials/);
  assert.doesNotMatch(loginRoute, /tenantId/);
  assert.match(logoutRoute, /clearAdminCookie/);
  assert.match(auth, /ADMIN_TENANT_ID = "qianlin-travel"/);
  assert.match(auth, /HttpOnly/);
  assert.match(auth, /SameSite=Lax/);
  assert.match(auth, /process\.env\.NODE_ENV === "production"/);
  assert.match(dashboard, /ADMIN_TENANT_ID/);
  assert.match(dashboard, /eq\(inquiries\.tenantId, ADMIN_TENANT_ID\)/);
  assert.match(dashboard, /tenantSiteProfiles\.tenantId, ADMIN_TENANT_ID/);
  assert.doesNotMatch(dashboard, /yunnan-demo|message|phone\.from/);
  assert.match(env, /ADMIN_USERNAME=/);
  assert.match(env, /ADMIN_PASSWORD_HASH=/);
  assert.match(env, /ADMIN_SESSION_SECRET=/);
  assert.doesNotMatch(env, /TestPassword|qianlin-admin-test/);
});
