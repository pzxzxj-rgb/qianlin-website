import { requireAdminAccess, requireAdminSession, type AdminRole, type AdminAccessContext } from "./auth";

function errorResponse(errorZh: string, errorEn: string, status: number) {
  return Response.json({ errorZh, errorEn }, { status, headers: { "Cache-Control": "no-store" } });
}

export type AdminRouteAccess = { access: AdminAccessContext } | { response: Response };

function getTenantSlugFromAdminPath(request: Request) {
  const match = new URL(request.url).pathname.match(/^\/api\/admin\/t\/([a-z0-9]+(?:-[a-z0-9]+)*)\//);
  return match?.[1];
}

export async function getAdminRouteAccess(request: Request, tenantSlug: string | undefined, minimumRole: AdminRole): Promise<AdminRouteAccess> {
  const session = await requireAdminSession(request);
  if (!session) return { response: errorResponse("登录状态已失效，请重新登录。", "Your admin session is invalid or expired.", 401) };
  const requestedTenantSlug = tenantSlug || getTenantSlugFromAdminPath(request) || session.tenantSlug;
  const access = await requireAdminAccess(request, requestedTenantSlug, minimumRole).catch(() => null);
  if (!access) return { response: errorResponse("当前管理员没有权限访问该租户。", "You are not allowed to access this tenant.", 403) };
  return { access };
}
