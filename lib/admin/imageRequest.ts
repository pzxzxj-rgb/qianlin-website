import { type AdminRole } from "./auth";
import { getAdminRouteAccess } from "./routeAccess";
import type { AdminPermission } from "./permissions";
import { readRequestBodyWithinLimit, verifySameOriginRequest } from "./requestSecurity";

function errorResponse(errorZh: string, errorEn: string, status: number) {
  return Response.json({ errorZh, errorEn }, { status, headers: { "Cache-Control": "no-store" } });
}

export type AdminJsonRequest = { tenantId: string; tenantSlug: string; userId: string; sessionId: string; body: unknown };
export type AdminJsonRequestError = { response: Response };

export async function readAdminJsonRequest(request: Request, maxBytes: number, resourceLabel = "Admin resource", tenantSlug?: string, minimumRole: AdminRole = "editor", requiredPermission?: AdminPermission): Promise<AdminJsonRequest | AdminJsonRequestError> {
  const trusted = await getAdminRouteAccess(request, tenantSlug, minimumRole, requiredPermission);
  if ("response" in trusted) return trusted;
  const { access } = trusted;
  if (!verifySameOriginRequest(request)) return { response: errorResponse("请求来源无效。", "Invalid request origin.", 403) };
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") return { response: errorResponse(`${resourceLabel}保存请求必须使用 JSON 格式。`, `${resourceLabel} updates must use application/json.`, 415) };

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) return { response: errorResponse(`${resourceLabel}保存请求过大。`, `${resourceLabel} update request is too large.`, 413) };
  const rawBody = await readRequestBodyWithinLimit(request, maxBytes);
  if (rawBody === null) return { response: errorResponse(`${resourceLabel}保存请求过大。`, `${resourceLabel} update request is too large.`, 413) };

  try {
    return { tenantId: access.tenantId, tenantSlug: access.tenantSlug, userId: access.userId, sessionId: access.sessionId, body: JSON.parse(rawBody) };
  } catch {
    return { response: errorResponse(`${resourceLabel}保存内容不是有效 JSON。`, `${resourceLabel} update JSON is invalid.`, 400) };
  }
}
