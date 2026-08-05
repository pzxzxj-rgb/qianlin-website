import { createAdminCookie, createAdminSession, isAdminConfigured, verifyAdminCredentials } from "../../../../lib/admin/auth";

function errorResponse(errorZh: string, errorEn: string, status: number) {
  return Response.json({ errorZh, errorEn }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!await isAdminConfigured()) return errorResponse("管理后台尚未完成登录配置。", "Admin login is not configured.", 503);

  let body: unknown;
  try {
    body = await request.json();
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
