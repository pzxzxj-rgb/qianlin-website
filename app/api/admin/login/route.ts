import { createAdminCookie, createAdminSession, isAdminConfigured, verifyAdminCredentials } from "../../../../lib/admin/auth";

const ADMIN_LOGIN_BODY_MAX_BYTES = 8 * 1024;

function errorResponse(errorZh: string, errorEn: string, status: number) {
  return Response.json({ errorZh, errorEn }, { status, headers: { "Cache-Control": "no-store" } });
}

async function readBodyWithinLimit(request: Request) {
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    totalBytes += value.byteLength;
    if (totalBytes > ADMIN_LOGIN_BODY_MAX_BYTES) {
      try {
        await reader.cancel();
      } catch {
        // The request is already being rejected.
      }
      return null;
    }
    chunks.push(value);
  }

  const bodyBytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bodyBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bodyBytes);
}

export async function POST(request: Request) {
  if (!await isAdminConfigured()) return errorResponse("管理后台尚未完成登录配置。", "Admin login is not configured.", 503);

  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") return errorResponse("登录请求必须使用 JSON 格式。", "Login requests must use application/json.", 415);

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > ADMIN_LOGIN_BODY_MAX_BYTES) {
    return errorResponse("登录请求过大。", "Login request is too large.", 413);
  }

  const rawBody = await readBodyWithinLimit(request);
  if (rawBody === null) return errorResponse("登录请求过大。", "Login request is too large.", 413);

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return errorResponse("登录信息不正确。", "Invalid login request.", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return errorResponse("登录信息不正确。", "Invalid login request.", 400);

  const payload = body as { username?: unknown; password?: unknown };
  const username = typeof payload.username === "string" ? payload.username.trim() : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  if (username.length > 120 || password.length > 512 || !username || !password) return errorResponse("账号或密码错误。", "Invalid username or password.", 401);

  if (!await verifyAdminCredentials(username, password)) return errorResponse("账号或密码错误。", "Invalid username or password.", 401);

  try {
    const token = await createAdminSession();
    if (!token) return errorResponse("管理后台尚未完成登录配置。", "Admin login is not configured.", 503);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store", "Set-Cookie": createAdminCookie(token) } });
  } catch {
    return errorResponse("登录服务暂时不可用。", "The login service is temporarily unavailable.", 503);
  }
}
