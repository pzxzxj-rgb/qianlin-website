import { changeAdminPassword, clearAdminCookie } from "../../../../../lib/admin/auth";
import { readAdminJsonRequest } from "../../../../../lib/admin/imageRequest";

const PASSWORD_BODY_MAX_BYTES = 8 * 1024;

function errorResponse(errorZh: string, errorEn: string, status: number) {
  return Response.json({ errorZh, errorEn }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const parsed = await readAdminJsonRequest(request, PASSWORD_BODY_MAX_BYTES, "Password", undefined, "viewer");
  if ("response" in parsed) return parsed.response;
  if (!parsed.body || typeof parsed.body !== "object" || Array.isArray(parsed.body)) return errorResponse("密码修改请求无效。", "Password change payload is invalid.", 400);
  const body = parsed.body as Record<string, unknown>;
  const allowed = ["currentPassword", "newPassword"];
  if (Object.keys(body).some((key) => !allowed.includes(key))) return errorResponse("请求包含不支持的字段。", "Password change contains unsupported fields.", 400);
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  if (currentPassword.length > 512 || newPassword.length < 12 || newPassword.length > 512) return errorResponse("密码长度不符合要求。", "Password length is invalid.", 400);
  const changed = await changeAdminPassword(parsed.userId, currentPassword, newPassword).catch(() => false);
  if (!changed) return errorResponse("当前密码不正确。", "The current password is incorrect.", 401);
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store", "Set-Cookie": clearAdminCookie() } });
}
