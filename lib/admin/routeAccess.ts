import { requireAdminAccess, requireAdminSession, SUPPORTED_ADMIN_TENANT_ID, type AdminRole, type AdminAccessContext } from "./auth";
import { recordAdminAudit } from "./audit";
import type { AdminPermission } from "./permissions";

function errorResponse(errorZh: string, errorEn: string, status: number) {
  return Response.json({ errorZh, errorEn }, { status, headers: { "Cache-Control": "no-store" } });
}

export type AdminRouteAccess = { access: AdminAccessContext } | { response: Response };

function getTenantSlugFromAdminPath(request: Request) {
  const match = new URL(request.url).pathname.match(/^\/api\/admin\/t\/([a-z0-9]+(?:-[a-z0-9]+)*)\//);
  return match?.[1];
}

export async function getAdminRouteAccess(request: Request, tenantSlug: string | undefined, minimumRole: AdminRole, requiredPermission?: AdminPermission): Promise<AdminRouteAccess> {
  const session = await requireAdminSession(request);
  if (!session) {
    await recordAdminAudit({ tenantId: SUPPORTED_ADMIN_TENANT_ID, action: "access_denied", resourceType: "admin_route", result: "failure", metadata: { reason: "invalid_session" } }).catch(() => undefined);
    return { response: errorResponse("登录状态已失效，请重新登录。", "Your admin session is invalid or expired.", 401) };
  }
  const requestedTenantSlug = tenantSlug || getTenantSlugFromAdminPath(request) || session.tenantSlug;
  const access = await requireAdminAccess(request, requestedTenantSlug, minimumRole, requiredPermission).catch(() => null);
  if (!access) {
    await recordAdminAudit({ tenantId: SUPPORTED_ADMIN_TENANT_ID, userId: session.userId, action: "access_denied", resourceType: "admin_route", result: "failure", metadata: { reason: "tenant_or_role_denied" } }).catch(() => undefined);
    return { response: errorResponse("当前管理员没有权限访问该租户。", "You are not allowed to access this tenant.", 403) };
  }
  return { access };
}
