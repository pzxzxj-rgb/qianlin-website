import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = await fs.readFile(path.join(projectRoot, "lib/security/turnstile.ts"), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { verifyTurnstileToken } = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);

const originalFetch = globalThis.fetch;
const originalNodeEnv = process.env.NODE_ENV;
const originalSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const originalSecretKey = process.env.TURNSTILE_SECRET_KEY;

function setTurnstileEnv({ nodeEnv = "test", siteKey = "", secretKey = "" } = {}) {
  process.env.NODE_ENV = nodeEnv;
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = siteKey;
  process.env.TURNSTILE_SECRET_KEY = secretKey;
}

test.after(() => {
  globalThis.fetch = originalFetch;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalSiteKey === undefined) delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  else process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = originalSiteKey;
  if (originalSecretKey === undefined) delete process.env.TURNSTILE_SECRET_KEY;
  else process.env.TURNSTILE_SECRET_KEY = originalSecretKey;
});

test("allows Turnstile to be disabled locally when both keys are empty", async () => {
  setTurnstileEnv({ nodeEnv: "development" });
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("Cloudflare should not be called when Turnstile is disabled");
  };
  const result = await verifyTurnstileToken("", new Request("http://localhost"));
  assert.deepEqual(result, { ok: true, code: "disabled" });
  assert.equal(fetchCalls, 0);
});

test("reports missing production or partial key configuration", async () => {
  setTurnstileEnv({ nodeEnv: "production" });
  assert.deepEqual(await verifyTurnstileToken("", new Request("http://localhost")), { ok: false, code: "not_configured" });

  setTurnstileEnv({ nodeEnv: "production", siteKey: "site-only" });
  assert.deepEqual(await verifyTurnstileToken("token", new Request("http://localhost")), { ok: false, code: "not_configured" });

  setTurnstileEnv({ nodeEnv: "production", secretKey: "secret-only" });
  assert.deepEqual(await verifyTurnstileToken("token", new Request("http://localhost")), { ok: false, code: "not_configured" });
});

test("classifies a missing token as invalid when both keys are configured", async () => {
  setTurnstileEnv({ nodeEnv: "production", siteKey: "site", secretKey: "secret" });
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("Cloudflare should not be called for an empty token");
  };
  const result = await verifyTurnstileToken("", new Request("http://localhost"));
  assert.deepEqual(result, { ok: false, code: "invalid" });
  assert.equal(fetchCalls, 0);
});

test("classifies Cloudflare rejection as invalid", async () => {
  setTurnstileEnv({ nodeEnv: "production", siteKey: "site", secretKey: "secret" });
  globalThis.fetch = async () => new Response(JSON.stringify({ success: false }), { status: 200 });
  assert.deepEqual(await verifyTurnstileToken("token", new Request("http://localhost")), { ok: false, code: "invalid" });
});

test("accepts a successful mocked Cloudflare response", async () => {
  setTurnstileEnv({ nodeEnv: "production", siteKey: "site", secretKey: "secret" });
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true }), { status: 200 });
  assert.deepEqual(await verifyTurnstileToken("token", new Request("http://localhost")), { ok: true, code: "verified" });
});

test("classifies a Cloudflare network failure as invalid", async () => {
  setTurnstileEnv({ nodeEnv: "production", siteKey: "site", secretKey: "secret" });
  globalThis.fetch = async () => { throw new Error("network failure"); };
  assert.deepEqual(await verifyTurnstileToken("token", new Request("http://localhost")), { ok: false, code: "invalid" });
});

test("keeps the widget reset and submit gating contract in the form", async () => {
  const widget = await fs.readFile(path.join(projectRoot, "components/TurnstileWidget.tsx"), "utf8");
  const form = await fs.readFile(path.join(projectRoot, "components/CustomizeForm.tsx"), "utf8");
  assert.match(widget, /reset: \(widgetId: string\)/);
  assert.match(widget, /resetKey/);
  assert.match(widget, /expired-callback/);
  assert.match(widget, /error-callback/);
  assert.match(form, /resetKey=\{turnstileResetKey\}/);
  assert.match(form, /resetTurnstile\(\)/);
  assert.match(form, /disabled=\{submitting \|\| \(Boolean\(turnstileSiteKey\) && !turnstileToken\)\}/);
  assert.match(form, /请先完成人机验证/);
});
