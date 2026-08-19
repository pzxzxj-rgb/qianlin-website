import assert from "node:assert/strict";
import { configuredProviderName } from "../lib/integrations/erp/providerFactory.ts";
import { getAppEnvironment } from "../lib/runtime/environment.ts";
import { verifyTurnstileToken } from "../lib/security/turnstile.ts";

const environmentKeys = ["APP_ENV", "ERP_PROVIDER", "NEXT_PUBLIC_TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"] as const;
const original = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));

function setEnvironment(values: Partial<Record<typeof environmentKeys[number], string | undefined>>) {
  for (const key of environmentKeys) {
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
}

try {
  setEnvironment({ APP_ENV: undefined });
  await assert.rejects(getAppEnvironment(), /APP_ENV must be explicitly configured/);
  setEnvironment({ APP_ENV: "staging" });
  await assert.rejects(getAppEnvironment(), /APP_ENV must be explicitly configured/);
  setEnvironment({ APP_ENV: "production" });
  assert.equal(await getAppEnvironment(), "production");
  setEnvironment({ APP_ENV: "test" });
  assert.equal(await getAppEnvironment(), "test");

  setEnvironment({ APP_ENV: "production", ERP_PROVIDER: "mock" });
  await assert.rejects(configuredProviderName("qianlin-travel"), /ERP_PROVIDER=mock is forbidden in production/);
  setEnvironment({ APP_ENV: "development", ERP_PROVIDER: "mock" });
  assert.equal(await configuredProviderName("qianlin-travel"), "mock");
  setEnvironment({ APP_ENV: "test", ERP_PROVIDER: "mock" });
  assert.equal(await configuredProviderName("qianlin-travel"), "mock");
  setEnvironment({ APP_ENV: "production", ERP_PROVIDER: "disabled" });
  assert.equal(await configuredProviderName("qianlin-travel"), "disabled");

  const request = new Request("http://localhost");
  setEnvironment({ APP_ENV: "production", ERP_PROVIDER: "disabled", NEXT_PUBLIC_TURNSTILE_SITE_KEY: "", TURNSTILE_SECRET_KEY: "" });
  assert.deepEqual(await verifyTurnstileToken("", request), { ok: false, code: "not_configured" });
  setEnvironment({ APP_ENV: "production", NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site-only", TURNSTILE_SECRET_KEY: "" });
  assert.deepEqual(await verifyTurnstileToken("token", request), { ok: false, code: "not_configured" });
  setEnvironment({ APP_ENV: "development", NEXT_PUBLIC_TURNSTILE_SITE_KEY: "", TURNSTILE_SECRET_KEY: "" });
  assert.deepEqual(await verifyTurnstileToken("", request), { ok: true, code: "disabled" });

  console.log("Runtime security tests passed: explicit APP_ENV, production ERP mock fail-closed, and Turnstile fail-closed configuration.");
} finally {
  for (const key of environmentKeys) {
    const value = original[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
