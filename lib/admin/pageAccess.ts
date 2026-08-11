import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminSessionFromCookie, requireAdminAccess, type AdminAccessContext, type AdminRole } from "./auth";
import type { AdminPermission } from "./permissions";

export async function getAdminPageAccess(tenantSlug: string | undefined, minimumRole: AdminRole, requiredPermission?: AdminPermission): Promise<AdminAccessContext> {
  const requestHeaders = await headers();
  const session = await getAdminSessionFromCookie(requestHeaders.get("cookie"));
  if (!session) redirect("/admin/login");
  const requestedSlug = tenantSlug || session.tenantSlug;
  const request = new Request(`https://admin.invalid/admin/t/${requestedSlug}/`, { headers: { cookie: requestHeaders.get("cookie") || "" } });
  const access = await requireAdminAccess(request, requestedSlug, minimumRole, requiredPermission);
  if (!access) redirect("/admin/login");
  return access;
}
