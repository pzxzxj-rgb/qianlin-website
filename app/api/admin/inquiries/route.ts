import { requireAdminSession, requireAdminTenant } from "../../../../lib/admin/auth";
import { ADMIN_INQUIRY_MAX_PAGE_SIZE, ADMIN_INQUIRY_STATUSES, getAdminInquiries, type AdminInquiryStatus } from "../../../../lib/admin/inquiries";

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
  const session = await requireAdminSession(request);
  if (!session) return errorResponse("登录状态已失效，请重新登录。", "Your admin session is invalid or expired.", 401);

  let tenantId: string;
  try {
    tenantId = requireAdminTenant(session);
  } catch {
    return errorResponse("当前管理员没有权限查看咨询。", "You are not allowed to view enquiries.", 403);
  }

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
