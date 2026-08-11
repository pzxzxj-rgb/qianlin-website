import { ADMIN_INQUIRY_MAX_PAGE_SIZE, ADMIN_INQUIRY_STATUSES, getAdminInquiries, type AdminInquiryStatus } from "../../../../lib/admin/inquiries";
import { getAdminRouteAccess } from "../../../../lib/admin/routeAccess";

export const dynamic = "force-dynamic";

function errorResponse(errorZh: string, errorEn: string, status: number) {
  return Response.json({ errorZh, errorEn }, { status, headers: { "Cache-Control": "no-store" } });
}

function parsePositiveInteger(value: string | null, fallback: number) {
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseStatus(value: string | null): AdminInquiryStatus | undefined | null {
  if (!value) return undefined;
  return ADMIN_INQUIRY_STATUSES.includes(value as AdminInquiryStatus) ? value as AdminInquiryStatus : null;
}

export async function GET(request: Request) {
  const trusted = await getAdminRouteAccess(request, undefined, "viewer", "inquiry:list_masked");
  if ("response" in trusted) return trusted.response;
  const { tenantId } = trusted.access;

  const url = new URL(request.url);
  const status = parseStatus(url.searchParams.get("status"));
  if (status === null) return errorResponse("咨询状态筛选条件无效。", "The enquiry status filter is invalid.", 400);
  const page = parsePositiveInteger(url.searchParams.get("page"), 1);
  const pageSize = parsePositiveInteger(url.searchParams.get("pageSize"), 20);
  if (page === null || pageSize === null || pageSize > ADMIN_INQUIRY_MAX_PAGE_SIZE) return errorResponse("分页参数无效。", "The pagination parameters are invalid.", 400);

  try {
    const data = await getAdminInquiries(tenantId, { status, page, pageSize });
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to load admin inquiries", error instanceof Error ? error.name : "UnknownError");
    return errorResponse("咨询暂时无法加载，请稍后重试。", "The enquiries could not be loaded right now.", 503);
  }
}
