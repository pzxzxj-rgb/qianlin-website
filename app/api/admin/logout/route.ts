import { clearAdminCookie } from "../../../../lib/admin/auth";

export async function POST() {
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store", "Set-Cookie": clearAdminCookie() } });
}
