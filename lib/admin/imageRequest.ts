import { requireAdminSession, requireAdminTenant } from "./auth";
import { readRequestBodyWithinLimit, verifySameOriginRequest } from "./requestSecurity";

function errorResponse(errorZh: string, errorEn: string, status: number) {
  return Response.json({ errorZh, errorEn }, { status, headers: { "Cache-Control": "no-store" } });
}

export type AdminJsonRequest = { tenantId: string; body: unknown };
export type AdminJsonRequestError = { response: Response };

export async function readAdminJsonRequest(request: Request, maxBytes: number, resourceLabel = "图片"): Promise<AdminJsonRequest | AdminJsonRequestError> {
  const session = await requireAdminSession(request);
  if (!session) return { response: errorResponse("登录状态已失效，请重新登录。", "Your admin session is invalid or expired.", 401) };

  let tenantId: string;
  try {
    tenantId = requireAdminTenant(session);
  } catch {
    return { response: errorResponse("当前管理员没有权限操作该租户。", "You are not allowed to edit this tenant.", 403) };
  }

  if (!verifySameOriginRequest(request)) return { response: errorResponse("请求来源无效。", "Invalid request origin.", 403) };
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") return { response: errorResponse(`${resourceLabel}保存请求必须使用 JSON 格式。`, `${resourceLabel} updates must use application/json.`, 415) };

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) return { response: errorResponse(`${resourceLabel}保存请求过大。`, `${resourceLabel} update request is too large.`, 413) };
  const rawBody = await readRequestBodyWithinLimit(request, maxBytes);
  if (rawBody === null) return { response: errorResponse(`${resourceLabel}保存请求过大。`, `${resourceLabel} update request is too large.`, 413) };

  try {
    return { tenantId, body: JSON.parse(rawBody) };
  } catch {
    return { response: errorResponse(`${resourceLabel}保存内容不是有效 JSON。`, `${resourceLabel} update JSON is invalid.`, 400) };
  }
}
