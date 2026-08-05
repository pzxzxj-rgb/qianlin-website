import { getPlannerOptionsForTenant } from "../../../../../../lib/planner/getOptionsForTenant";
import { resolveActiveTenantBySlug } from "../../../../../../lib/tenancy/resolveTenant";

function errorResponse(status = 503) {
  return Response.json({ errorZh: status === 404 ? "站点不存在或已暂停。" : "规划选项暂时无法加载，请稍后重试。", errorEn: status === 404 ? "This site does not exist or is not active." : "Planning options are temporarily unavailable. Please try again later." }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(_request: Request, context: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await context.params;
  try {
    const tenant = await resolveActiveTenantBySlug(tenantSlug);
    if (!tenant) return errorResponse(404);
    const response = await getPlannerOptionsForTenant(tenant);
    return Response.json(response, { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } });
  } catch (error) {
    console.error("Failed to load tenant planner options", error instanceof Error ? error.name : "UnknownError");
    return errorResponse();
  }
}
