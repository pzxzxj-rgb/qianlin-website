import { handleInquiry } from "../../../../../lib/inquiries/handleInquiry";
import { resolveActiveTenantBySlug } from "../../../../../lib/tenancy/resolveTenant";

export async function POST(request: Request, context: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await context.params;
  try {
    const tenant = await resolveActiveTenantBySlug(tenantSlug);
    if (!tenant) return Response.json({ errorZh: "站点不存在或已暂停。", errorEn: "This site does not exist or is not active." }, { status: 404 });
    if (tenant.isDemo) return Response.json({ errorZh: "演示站不接收真实咨询。", errorEn: "The demo site does not accept real enquiries." }, { status: 403 });
    return handleInquiry(request, tenant);
  } catch (error) {
    console.error("Failed to resolve tenant inquiry target", error instanceof Error ? error.name : "UnknownError");
    return Response.json({ errorZh: "咨询暂时无法提交，请稍后重试。", errorEn: "This enquiry cannot be submitted right now. Please try again later." }, { status: 503 });
  }
}
