import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
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

test("uses formal Chinese release metadata and keeps the production URL boundary explicit", async () => {
  const layout = await read("app/layout.tsx");
  const home = await read("app/page.tsx");
  const tenantPage = await read("app/t/[tenantSlug]/page.tsx");
  const siteUrl = await read("lib/siteUrl.ts");
  assert.match(layout, /黔林旅行社｜贵州定制旅行/);
  assert.match(layout, /黔林旅行社专注贵州目的地旅行/);
  assert.match(layout, /images: \[\{ url: "\/og\.png"/);
  assert.match(layout, /twitter: \{[^\n]+images: \["\/og\.png"\]/);
  assert.match(home, /openGraph: \{ title, description/);
  assert.match(home, /images: \[\{ url: "\/og\.png"/);
  assert.match(home, /twitter: \{ card: "summary_large_image", title, description, images: \["\/og\.png"\]/);
  assert.match(tenantPage, /images: \[\{ url: "\/og\.png"/);
  assert.match(tenantPage, /twitter: \{ card: "summary_large_image"/);
  assert.match(siteUrl, /must not point to a local development host in production/);
  assert.doesNotMatch(home, /alternates: \{ canonical: "http:\/\/localhost/);

  const output = ts.transpileModule(siteUrl, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const siteUrlModule = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
  const previousNodeEnv = process.env.NODE_ENV;
  const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  try {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    assert.throws(() => siteUrlModule.getSiteUrl(), /local development host/);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previousSiteUrl;
  }
});

test("keeps release checks and Cloudflare WAF guidance in the repository", async () => {
  const workflow = await read(".github/workflows/ci.yml");
  const readme = await read("README.md");
  assert.match(workflow, /node-version: 22/);
  assert.match(workflow, /cache: npm/);
  for (const command of ["npm ci", "npm run lint", "npm run build", "npm test", "npm run test:integration:local"]) assert.match(workflow, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(readme, /\/api\/admin\/login/);
  assert.match(readme, /\/api\/t\/\[\^\/\]\+\/inquiries/);
  assert.match(readme, /按 Source IP 计数/);
  assert.match(readme, /KV、Durable Object/);
});

test("keeps Hero controls accessible and motion-aware without static slide data", async () => {
  const hero = await read("components/Hero.tsx");
  const provider = await read("components/TenantSiteProvider.tsx");
  const tours = await read("components/Tours.tsx");
  const destinations = await read("components/Destinations.tsx");
  const about = await read("components/About.tsx");
  const customize = await read("components/CustomizeForm.tsx");
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
  assert.match(provider, /cache: "no-store"/);
  assert.match(provider, /visibilitychange/);
  assert.match(provider, /if \(!hasInitialConfig\)/);
  assert.match(plannerProvider, /AbortController/);
  assert.match(plannerProvider, /value\.tenantSlug !== tenantSlug/);
  for (const source of [hero, tours, destinations, about, customize]) {
    assert.match(source, /width=\{/);
    assert.match(source, /height=\{/);
    assert.match(source, /sizes=/);
    assert.match(source, /onError=/);
  }
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
  assert.match(readme, /后台咨询列表、详情和状态管理已在 3G MVP 中提供/);
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

test("keeps the 3A admin shell read-only, private, and fixed to qianlin-travel", async () => {
  const [adminPage, adminLayout, loginPage, loginRoute, logoutRoute, auth, dashboard, dashboardComponent, requestSecurity, env] = await Promise.all([
    read("app/admin/page.tsx"),
    read("app/admin/layout.tsx"),
    read("app/admin/login/page.tsx"),
    read("app/api/admin/login/route.ts"),
    read("app/api/admin/logout/route.ts"),
    read("lib/admin/auth.ts"),
    read("lib/admin/getAdminDashboard.ts"),
    read("components/AdminDashboard.tsx"),
    read("lib/admin/requestSecurity.ts"),
    read(".env.example"),
  ]);
  assert.match(adminPage, /getAdminSessionFromCookie/);
  assert.match(adminPage, /redirect\("\/admin\/login"\)/);
  assert.doesNotMatch(adminPage, /Link[^\n]+\/admin\/login/);
  assert.match(adminPage, /AdminReloadButton/);
  assert.match(adminPage, /AdminLogoutButton/);
  assert.match(adminPage, /fetchCache = "force-no-store"/);
  assert.match(adminPage, /title: "黔林旅行社管理后台"/);
  assert.match(adminPage, /robots: \{ index: false, follow: false \}/);
  assert.match(adminLayout, /robots: \{ index: false, follow: false \}/);
  assert.match(adminLayout, /alternates: null/);
  assert.match(adminLayout, /openGraph: null/);
  assert.match(adminLayout, /twitter: null/);
  assert.match(loginPage, /AdminLoginForm/);
  assert.match(loginPage, /fetchCache = "force-no-store"/);
  assert.match(loginPage, /title: "黔林旅行社后台登录"/);
  assert.match(loginPage, /<h1>后台登录<\/h1>/);
  assert.match(loginPage, /robots: \{ index: false, follow: false \}/);
  assert.match(loginRoute, /verifyAdminCredentials/);
  assert.match(loginRoute, /content-type/);
  assert.match(loginRoute, /ADMIN_LOGIN_BODY_MAX_BYTES/);
  assert.match(requestSecurity, /getReader/);
  assert.doesNotMatch(loginRoute, /tenantId/);
  assert.match(logoutRoute, /clearAdminCookie/);
  assert.match(auth, /ADMIN_TENANT_ID = "qianlin-travel"/);
  assert.match(auth, /MIN_ADMIN_SESSION_SECRET_LENGTH = 32/);
  assert.match(auth, /sessionSecret\.length >= MIN_ADMIN_SESSION_SECRET_LENGTH/);
  assert.match(auth, /HttpOnly/);
  assert.match(auth, /SameSite=Lax/);
  assert.match(auth, /process\.env\.NODE_ENV === "production"/);
  assert.match(dashboard, /ADMIN_TENANT_ID/);
  assert.match(dashboardComponent, /response\.ok/);
  assert.match(dashboardComponent, /window\.location\.replace\("\/admin\/login"\)/);
  assert.doesNotMatch(dashboardComponent, /window\.location\.assign\("\/admin\/login"\)/);
  assert.match(dashboard, /eq\(inquiries\.tenantId, ADMIN_TENANT_ID\)/);
  assert.match(dashboard, /tenantSiteProfiles\.tenantId, ADMIN_TENANT_ID/);
  assert.doesNotMatch(dashboard, /yunnan-demo|message|phone\.from/);
  assert.match(env, /ADMIN_USERNAME=/);
  assert.match(env, /ADMIN_PASSWORD_HASH=/);
  assert.match(env, /ADMIN_SESSION_SECRET=/);
  assert.doesNotMatch(env, /TestPassword|qianlin-admin-test/);
});

test("rejects tampered, expired, and cross-tenant admin sessions", async () => {
  const source = await read("lib/admin/auth.ts");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const auth = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
  const envNames = ["ADMIN_USERNAME", "ADMIN_PASSWORD_HASH", "ADMIN_SESSION_SECRET"];
  const previous = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
  const sessionSecret = "admin-session-secret-for-auth-tests-32-chars";

  const signedCookie = (tenantId, expiresAt) => {
    const payload = JSON.stringify({ tenantId, expiresAt });
    const encodedPayload = Buffer.from(payload, "utf8").toString("base64url");
    const signature = createHmac("sha256", sessionSecret).update(payload).digest("base64url");
    return `qianlin_admin_session=${encodedPayload}.${signature}`;
  };

  try {
    process.env.ADMIN_USERNAME = "auth-test";
    process.env.ADMIN_PASSWORD_HASH = "configured-test-hash";
    process.env.ADMIN_SESSION_SECRET = sessionSecret;
    assert.equal(await auth.isAdminConfigured(), true);

    const validToken = await auth.createAdminSession();
    assert.ok(validToken);
    const separator = validToken.lastIndexOf(".");
    const signature = validToken.slice(separator + 1);
    const tamperedSignature = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
    const tamperedToken = `${validToken.slice(0, separator + 1)}${tamperedSignature}`;
    assert.equal(await auth.getAdminSessionFromCookie(`qianlin_admin_session=${tamperedToken}`), null);
    assert.equal(await auth.getAdminSessionFromCookie(signedCookie("qianlin-travel", Math.floor(Date.now() / 1000) - 1)), null);
    assert.equal(await auth.getAdminSessionFromCookie(signedCookie("yunnan-demo", Math.floor(Date.now() / 1000) + 3600)), null);

    process.env.ADMIN_SESSION_SECRET = "too-short";
    assert.equal(await auth.isAdminConfigured(), false);
  } finally {
    for (const name of envNames) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});

test("keeps 3B company profile editing protected and limited", async () => {
  const [profilePage, profileForm, profileEditor, profileRoute, profileService, requestSecurity, dashboard, siteConfigRoute, legal, legalPage, legalCompany, readme] = await Promise.all([
    read("app/admin/profile/page.tsx"),
    read("components/AdminProfileForm.tsx"),
    read("components/AdminProfileEditor.tsx"),
    read("app/api/admin/profile/route.ts"),
    read("lib/admin/profile.ts"),
    read("lib/admin/requestSecurity.ts"),
    read("components/AdminDashboard.tsx"),
    read("app/api/t/[tenantSlug]/site-config/route.ts"),
    read("data/legal.ts"),
    read("components/LegalPage.tsx"),
    read("lib/legal/company.ts"),
    read("README.md"),
  ]);
  assert.match(profilePage, /getAdminSessionFromCookie/);
  assert.match(profilePage, /redirect\("\/admin\/login"\)/);
  assert.match(profilePage, /getAdminProfile/);
  assert.match(profilePage, /force-no-store/);
  assert.match(profileForm, /companyNameZh/);
  assert.match(profileForm, /companyNameEn/);
  assert.match(profileForm, /descriptionZh/);
  assert.match(profileForm, /descriptionEn/);
  assert.match(profileForm, /addressZh/);
  assert.match(profileForm, /addressEn/);
  assert.match(profileForm, /logoMark/);
  assert.match(profileForm, /aria-invalid/);
  assert.match(profileForm, /disabled=\{pending \|\| !isDirty\}/);
  assert.match(profileForm, /window\.confirm/);
  assert.match(profileForm, /confirmAdminProfileNavigation/);
  assert.match(profileForm, /router\.push\("\/admin"\)/);
  assert.match(profileForm, /router\.refresh\(\)/);
  assert.doesNotMatch(profileForm, /dangerouslySetInnerHTML|tenantId|tenantSlug|siteStatus|profileId/);
  assert.match(profileRoute, /requireAdminSession/);
  assert.match(profileRoute, /requireAdminTenant/);
  assert.match(profileRoute, /verifySameOriginRequest/);
  assert.match(profileRoute, /application\/json/);
  assert.match(profileRoute, /16 \* 1024/);
  assert.match(profileRoute, /updateAdminProfile/);
  assert.match(profileRoute, /Cache-Control.*no-store/);
  assert.doesNotMatch(profileRoute, /tenantId.*body|tenantSlug|siteStatus|isDemo|profileId/);
  assert.match(profileService, /eq\(tenantSiteProfiles\.tenantId, ADMIN_TENANT_ID\)/);
  assert.match(profileService, /eq\(tenantSiteProfiles\.status, "published"\)/);
  assert.match(profileService, /updatedAt: sql`CURRENT_TIMESTAMP`/);
  assert.match(profileService, /value\.trim\(\)/);
  assert.match(profileService, /companyNameZh/);
  assert.match(profileService, /logoMark/);
  assert.match(requestSecurity, /new URL\(origin\)\.origin === new URL\(request\.url\)\.origin/);
  assert.match(dashboard, /\/admin\/profile/);
  assert.match(siteConfigRoute, /"Cache-Control": "no-store"/);
  assert.match(readme, /已完成公司资料编辑/);
  assert.match(readme, /固定租户边界和同源请求验证/);
  assert.doesNotMatch(readme, /ADMIN_PASSWORD_HASH=.*\S+|ADMIN_SESSION_SECRET=.*\S+/);
  assert.match(legal, /createLegalDocuments/);
  assert.match(legal, /companyNameZh/);
  assert.match(legalPage, /company\.companyNameZh/);
  assert.match(legalCompany, /DEFAULT_TENANT_SLUG/);
  assert.match(legalCompany, /tenant\.slug !== DEFAULT_TENANT_SLUG/);
  assert.match(legalCompany, /tenant\.id !== ADMIN_TENANT_ID/);
  assert.match(legalCompany, /email: .*\.trim\(\)/);
  assert.doesNotMatch(legalCompany, /tenant\.id !== DEFAULT_TENANT_SLUG/);
  assert.doesNotMatch(legalCompany, /yunnan-demo/);
  assert.match(profileEditor, /onClick=\{handleReturn\}/g);
  assert.match(profileEditor, /confirmAdminProfileNavigation\(isDirty\)/);
});

test("generates legal documents from the current company profile", async () => {
  const source = await read("data/legal.ts");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const legal = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
  const documents = legal.createLegalDocuments({ companyNameZh: "新公司名称", companyNameEn: "New Company", addressZh: "新公司地址", email: "new@example.com", logoMark: "N" });
  const text = JSON.stringify(documents);
  assert.match(text, /新公司名称/);
  assert.match(text, /新公司地址/);
  assert.match(text, /new@example\.com/);
  assert.doesNotMatch(text, /yunnan-demo|云南旅行社演示站/);
});
