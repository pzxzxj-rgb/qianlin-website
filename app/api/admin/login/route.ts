import { createAdminCookie, createAdminSession, isAdminConfigured, SUPPORTED_ADMIN_TENANT_ID, verifyAdminCredentials } from "../../../../lib/admin/auth";
import { recordAdminAudit } from "../../../../lib/admin/audit";
import { readRequestBodyWithinLimit } from "../../../../lib/admin/requestSecurity";
import { checkRateLimit, clearRateLimit, getRequestAddress } from "../../../../lib/security/rateLimit";

const ADMIN_LOGIN_BODY_MAX_BYTES = 8 * 1024;

function errorResponse(errorZh: string, errorEn: string, status: number) {
  return Response.json({ errorZh, errorEn }, { status, headers: { "Cache-Control": "no-store" } });
}

async function recordLoginAudit(result: "success" | "failure", userId: string | null, reason: string) {
  await recordAdminAudit({ tenantId: SUPPORTED_ADMIN_TENANT_ID, userId, action: "login", resourceType: "admin_session", result, metadata: { reason } }).catch(() => undefined);
}

export async function POST(request: Request) {
  if (!await isAdminConfigured()) {
    await recordLoginAudit("failure", null, "not_configured");
    return errorResponse("管理后台尚未完成登录配置。", "Admin login is not configured.", 503);
  }
  const address = getRequestAddress(request);
  const rateLimitKey = `admin-login:${address}`;
  const rateLimit = checkRateLimit(rateLimitKey, 10, 15 * 60 * 1000);
  if (!rateLimit.allowed) {
    await recordLoginAudit("failure", null, "rate_limited");
    return new Response(JSON.stringify({ errorZh: "登录尝试过于频繁，请稍后重试。", errorEn: "Too many login attempts. Please try again later." }), { status: 429, headers: { "Cache-Control": "no-store", "Content-Type": "application/json", "Retry-After": String(rateLimit.retryAfterSeconds) } });
  }

  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    await recordLoginAudit("failure", null, "invalid_content_type");
    return errorResponse("登录请求必须使用 JSON 格式。", "Login requests must use application/json.", 415);
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > ADMIN_LOGIN_BODY_MAX_BYTES) {
    await recordLoginAudit("failure", null, "body_too_large");
    return errorResponse("登录请求过大。", "Login request is too large.", 413);
  }

  const rawBody = await readRequestBodyWithinLimit(request, ADMIN_LOGIN_BODY_MAX_BYTES);
  if (rawBody === null) {
    await recordLoginAudit("failure", null, "body_too_large");
    return errorResponse("登录请求过大。", "Login request is too large.", 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    await recordLoginAudit("failure", null, "invalid_json");
    return errorResponse("登录信息不正确。", "Invalid login request.", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    await recordLoginAudit("failure", null, "invalid_payload");
    return errorResponse("登录信息不正确。", "Invalid login request.", 400);
  }

  const payload = body as Record<string, unknown>;
  if (Object.keys(payload).some((key) => key !== "username" && key !== "password")) {
    await recordLoginAudit("failure", null, "unsupported_fields");
    return errorResponse("登录请求包含不支持的字段。", "Login request contains unsupported fields.", 400);
  }
  const username = typeof payload.username === "string" ? payload.username.trim() : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  if (username.length > 120 || password.length > 512 || !username || !password) {
    await recordLoginAudit("failure", null, "invalid_credentials_format");
    return errorResponse("账号或密码错误。", "Invalid username or password.", 401);
  }

  const user = await verifyAdminCredentials(username, password).catch(() => null);
  if (!user) {
    await recordLoginAudit("failure", null, "invalid_credentials");
    return errorResponse("账号或密码错误。", "Invalid username or password.", 401);
  }

  try {
    const token = await createAdminSession(user.id);
    if (!token) {
      await recordLoginAudit("failure", user.id, "session_creation_failed");
      return errorResponse("管理后台尚未完成登录配置。", "Admin login is not configured.", 503);
    }
    clearRateLimit(rateLimitKey);
    await recordLoginAudit("success", user.id, "credentials_verified");
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store", "Set-Cookie": await createAdminCookie(token) } });
  } catch {
    await recordLoginAudit("failure", user.id, "session_creation_failed");
    return errorResponse("登录服务暂时不可用。", "The login service is temporarily unavailable.", 503);
  }
}
