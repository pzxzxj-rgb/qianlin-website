import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminSessionFromCookie, requireAdminAccess, type AdminAccessContext, type AdminRole } from "./auth";

export async function getAdminPageAccess(tenantSlug: string | undefined, minimumRole: AdminRole): Promise<AdminAccessContext> {
  const requestHeaders = await headers();
  const session = await getAdminSessionFromCookie(requestHeaders.get("cookie"));
  if (!session) redirect("/admin/login");
  const requestedSlug = tenantSlug || session.tenantSlug;
  const request = new Request(`https://admin.invalid/admin/t/${requestedSlug}/`, { headers: { cookie: requestHeaders.get("cookie") || "" } });
  const access = await requireAdminAccess(request, requestedSlug, minimumRole);
  if (!access) redirect("/admin/login");
  return access;
}
