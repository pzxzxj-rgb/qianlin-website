import { getAdminRouteAccess } from "@/lib/admin/routeAccess";
import { getAdminThemeState } from "@/lib/admin/theme";

export async function GET(request: Request, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const trusted = await getAdminRouteAccess(request, tenantSlug, "viewer", "theme:read");
  if ("response" in trusted) return trusted.response;
  try {
    const state = await getAdminThemeState(trusted.access.tenantId);
    return Response.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to load admin theme", error instanceof Error ? error.name : "UnknownError");
    return Response.json({ errorZh: "主题配置暂时无法加载。", errorEn: "Theme configuration is unavailable." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
