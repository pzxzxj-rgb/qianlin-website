import { getDefaultTenant } from "../../../../lib/tenancy/resolveTenant";
import { getPlannerOptionsForTenant } from "../../../../lib/planner/getOptionsForTenant";

function errorResponse() {
  return Response.json({ errorZh: "规划选项暂时无法加载，请稍后重试。", errorEn: "Planning options are temporarily unavailable. Please try again later." }, { status: 503, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  try {
    const tenant = await getDefaultTenant();
    if (!tenant) return errorResponse();
    const response = await getPlannerOptionsForTenant(tenant);
    return Response.json(response, { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } });
  } catch (error) {
    console.error("Failed to load planner options", error instanceof Error ? error.name : "UnknownError");
    return errorResponse();
  }
}
