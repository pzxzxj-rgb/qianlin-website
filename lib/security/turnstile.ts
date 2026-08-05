type TurnstileVerification = {
  ok: boolean;
  code: "disabled" | "verified" | "invalid" | "not_configured";
};

export async function verifyTurnstileToken(token: string, request: Request): Promise<TurnstileVerification> {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim() ?? "";
  const production = process.env.NODE_ENV === "production";

  if (!siteKey && !secretKey) {
    return production ? { ok: false, code: "not_configured" } : { ok: true, code: "disabled" };
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
