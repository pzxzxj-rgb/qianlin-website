import { getTenantSiteConfig, resolveActiveTenantBySlug } from "../../../../../lib/tenancy/resolveTenant";

function unavailableResponse() {
  return Response.json({ errorZh: "网站资料暂时无法加载，请稍后重试。", errorEn: "This site is temporarily unavailable. Please try again later." }, { status: 503, headers: { "Cache-Control": "no-store" } });
}

export async function GET(_request: Request, context: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await context.params;
  try {
    const tenant = await resolveActiveTenantBySlug(tenantSlug);
    if (!tenant) return Response.json({ errorZh: "网站不存在或已暂停。", errorEn: "This site does not exist or is not active." }, { status: 404 });
    const config = await getTenantSiteConfig(tenant);
    return Response.json(config, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to load tenant site config", error instanceof Error ? error.name : "UnknownError");
    return unavailableResponse();
  }
}
