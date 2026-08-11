import { clearAdminCookie, getAdminSessionFromCookie, revokeAdminSession, SUPPORTED_ADMIN_TENANT_ID } from "../../../../lib/admin/auth";
import { recordAdminAudit } from "../../../../lib/admin/audit";

export async function POST(request: Request) {
  const session = await getAdminSessionFromCookie(request.headers.get("cookie"));
  await revokeAdminSession(request).catch(() => undefined);
  await recordAdminAudit({ tenantId: SUPPORTED_ADMIN_TENANT_ID, userId: session?.userId ?? null, action: "logout", resourceType: "admin_session", result: session ? "success" : "failure", metadata: { reason: session ? "session_revoked" : "invalid_session" } }).catch(() => undefined);
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store", "Set-Cookie": clearAdminCookie() } });
}
