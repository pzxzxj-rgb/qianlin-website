import { handleInquiry } from "../../../../../lib/inquiries/handleInquiry";
import { resolveActiveTenantBySlug } from "../../../../../lib/tenancy/resolveTenant";
import { checkRateLimit, getRequestAddress } from "../../../../../lib/security/rateLimit";

export async function POST(request: Request, context: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await context.params;
  try {
    const tenant = await resolveActiveTenantBySlug(tenantSlug);
    if (!tenant) return Response.json({ errorZh: "网站不存在或已暂停。", errorEn: "This site does not exist or is not active." }, { status: 404 });
    if (tenant.isDemo || tenant.siteStatus !== "published") return Response.json({ errorZh: tenant.isDemo ? "演示站点不接收真实咨询。" : "网站尚未开放咨询。", errorEn: tenant.isDemo ? "The demo site does not accept real enquiries." : "This site is not accepting enquiries yet." }, { status: 403 });
    const rateLimit = checkRateLimit(`inquiry:${tenant.id}:${getRequestAddress(request)}`, 30, 10 * 60 * 1000);
    if (!rateLimit.allowed) return Response.json({ errorZh: "提交过于频繁，请稍后重试。", errorEn: "Too many enquiries. Please try again later." }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(rateLimit.retryAfterSeconds) } });
    return handleInquiry(request, tenant);
  } catch (error) {
    console.error("Failed to resolve tenant inquiry target", error instanceof Error ? error.name : "UnknownError");
    return Response.json({ errorZh: "咨询暂时无法提交，请稍后重试。", errorEn: "This enquiry cannot be submitted right now. Please try again later." }, { status: 503 });
  }
}
