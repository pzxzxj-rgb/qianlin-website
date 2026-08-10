import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFile(path.join(projectRoot, file), "utf8");

test("keeps dynamic tenant metadata and production URL boundaries", async () => {
  const [layout, home, tenantPage, siteUrl] = await Promise.all([read("app/layout.tsx"), read("app/page.tsx"), read("app/t/[tenantSlug]/page.tsx"), read("lib/siteUrl.ts")]);
  assert.match(layout, /defaultTitle/);
  assert.match(layout, /metadataBase/);
  assert.match(layout, /images: \[\{ url: "\/og\.png"/);
  assert.match(layout, /twitter:/);
  assert.match(home, /generateMetadata/);
  assert.match(home, /const image = siteConfig\.profile\.ogImageUrl \|\| "\/og\.png"/);
  assert.match(home, /robots: isPublic/);
  assert.match(tenantPage, /alternates: \{ canonical:/);
  assert.match(tenantPage, /robots: isPublic/);
  assert.match(tenantPage, /\/og\.png/);
  assert.match(siteUrl, /must not point to a local development host in production/);
  assert.doesNotMatch(home, /canonical: "http:\/\/localhost/);
});

test("keeps CI quality gates and external rate limiting guidance", async () => {
  const [workflow, readme] = await Promise.all([read(".github/workflows/ci.yml"), read("README.md")]);
  assert.match(workflow, /node-version: 22/);
  assert.match(workflow, /cache: npm/);
  for (const command of ["npm ci", "npm run lint", "npm run typecheck", "npm run build", "npm test", "npm run test:integration:local", "npm audit --omit=dev --audit-level=high"]) assert.match(workflow, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(readme, /Rate limiting|频率限制|Source IP/i);
  assert.match(readme, /\/api\/admin\/login/);
});

test("keeps the tenant site provider refresh strategy guarded", async () => {
  const [provider, plannerProvider, home] = await Promise.all([read("components/TenantSiteProvider.tsx"), read("components/PlannerOptionsProvider.tsx"), read("components/TenantHomeClient.tsx")]);
  assert.match(provider, /AbortController/);
  assert.match(provider, /cache: "no-store"/);
  assert.match(provider, /if \(!hasInitialConfig\)/);
  assert.match(provider, /visibilitychange/);
  assert.match(plannerProvider, /AbortController/);
  assert.match(home, /siteConfig\.isConfigured/);
});

test("keeps public images and inquiries safe", async () => {
  const [hero, tours, destinations, about, customize, inquiry, turnstile] = await Promise.all([
    read("components/Hero.tsx"),
    read("components/Tours.tsx"),
    read("components/Destinations.tsx"),
    read("components/About.tsx"),
    read("components/CustomizeForm.tsx"),
    read("lib/inquiries/handleInquiry.ts"),
    read("lib/security/turnstile.ts"),
  ]);
  for (const source of [hero, tours, destinations, about, customize]) {
    assert.match(source, /width=\{/);
    assert.match(source, /height=\{/);
    assert.match(source, /onError=/);
  }
  assert.match(inquiry, /isValidMainlandPhone/);
  assert.match(inquiry, /privacyConsentAt/);
  assert.match(inquiry, /createInquirySyncJob/);
  assert.match(turnstile, /TURNSTILE_SECRET_KEY/);
});

test("keeps admin identity, revocation, audit, and private metadata boundaries", async () => {
  const [auth, adminPage, adminLayout, login, logout, audit, passwordRoute, worker] = await Promise.all([
    read("lib/admin/auth.ts"),
    read("app/admin/page.tsx"),
    read("app/admin/layout.tsx"),
    read("app/api/admin/login/route.ts"),
    read("app/api/admin/logout/route.ts"),
    read("lib/admin/audit.ts"),
    read("app/api/admin/account/password/route.ts"),
    read("worker/index.ts"),
  ]);
  assert.match(auth, /sessions/);
  assert.match(auth, /revokedAt/);
  assert.match(auth, /revokeAllAdminSessions/);
  assert.match(auth, /tenantMemberships/);
  assert.doesNotMatch(auth, /ADMIN_TENANT_ID\s*=\s*["']qianlin-travel/);
  assert.match(adminPage, /getAdminPageAccess/);
  assert.match(adminLayout, /robots: \{ index: false, follow: false \}/);
  assert.match(login, /checkRateLimit/);
  assert.match(logout, /revokeAdminSession/);
  assert.match(audit, /adminAuditLogs/);
  assert.match(passwordRoute, /changeAdminPassword/);
  assert.match(passwordRoute, /clearAdminCookie/);
  assert.match(worker, /Content-Security-Policy/);
  assert.match(worker, /Strict-Transport-Security/);
  assert.match(worker, /challenges\.cloudflare\.com/);
});
