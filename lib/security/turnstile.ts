import { getAppEnvironment } from "../runtime/environment";

type TurnstileVerification = {
  ok: boolean;
  code: "disabled" | "verified" | "invalid" | "not_configured";
};

async function readRuntimeVariable(name: string) {
  try {
    const { env } = await import("cloudflare:workers");
    const value = (env as unknown as Record<string, unknown>)[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  } catch {
    // Node-based tests and local callers fall back to process.env.
  }
  return typeof process !== "undefined" ? process.env[name]?.trim() ?? "" : "";
}

export async function verifyTurnstileToken(token: string, request: Request): Promise<TurnstileVerification> {
  const appEnv = await getAppEnvironment();
  const [siteKey, secretKey] = await Promise.all([
    readRuntimeVariable("NEXT_PUBLIC_TURNSTILE_SITE_KEY"),
    readRuntimeVariable("TURNSTILE_SECRET_KEY"),
  ]);

  if (!siteKey && !secretKey) {
    return appEnv === "production" ? { ok: false, code: "not_configured" } : { ok: true, code: "disabled" };
  }
  if (!siteKey || !secretKey) return { ok: false, code: "not_configured" };
  if (!token) return { ok: false, code: "invalid" };

  try {
    const body = new FormData();
    body.append("secret", secretKey);
    body.append("response", token);
    const remoteIp = request.headers.get("CF-Connecting-IP");
    if (remoteIp) body.append("remoteip", remoteIp);
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    if (!response.ok) return { ok: false, code: "invalid" };
    const result = await response.json() as { success?: boolean };
    return result.success === true ? { ok: true, code: "verified" } : { ok: false, code: "invalid" };
  } catch {
    return { ok: false, code: "invalid" };
  }
}
