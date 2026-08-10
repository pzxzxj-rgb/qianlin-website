import { clearAdminCookie, revokeAdminSession } from "../../../../lib/admin/auth";

export async function POST(request: Request) {
  await revokeAdminSession(request).catch(() => undefined);
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store", "Set-Cookie": clearAdminCookie() } });
}
