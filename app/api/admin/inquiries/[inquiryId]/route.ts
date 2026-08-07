import { requireAdminSession, requireAdminTenant } from "../../../../../lib/admin/auth";
import { getAdminInquiryDetail, updateAdminInquiryStatus, ADMIN_INQUIRY_STATUSES, type AdminInquiryStatus } from "../../../../../lib/admin/inquiries";
import { readRequestBodyWithinLimit, verifySameOriginRequest } from "../../../../../lib/admin/requestSecurity";

const ADMIN_INQUIRY_STATUS_BODY_MAX_BYTES = 4 * 1024;

function errorResponse(errorZh: string, errorEn: string, status: number) {
  return Response.json({ errorZh, errorEn }, { status, headers: { "Cache-Control": "no-store" } });
}

function parseInquiryId(value: string) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function isAdminInquiryStatus(value: unknown): value is AdminInquiryStatus {
  return typeof value === "string" && ADMIN_INQUIRY_STATUSES.includes(value as AdminInquiryStatus);
}

async function getTenantId(request: Request) {
  const session = await requireAdminSession(request);
  if (!session) return { error: errorResponse("登录状态已失效，请重新登录。", "Your admin session is invalid or expired.", 401) } as const;
  try {
    return { tenantId: requireAdminTenant(session) } as const;
  } catch {
    return { error: errorResponse("当前管理员没有权限查看咨询。", "You are not allowed to view enquiries.", 403) } as const;
  }
}

export async function GET(request: Request, context: { params: Promise<{ inquiryId: string }> }) {
  const access = await getTenantId(request);
  if ("error" in access) return access.error;
  const { inquiryId: rawInquiryId } = await context.params;
  const inquiryId = parseInquiryId(rawInquiryId);
  if (inquiryId === null) return errorResponse("咨询编号无效。", "The enquiry ID is invalid.", 400);

  try {
    const inquiry = await getAdminInquiryDetail(access.tenantId, inquiryId);
    return inquiry ? Response.json({ inquiry }, { headers: { "Cache-Control": "no-store" } }) : errorResponse("咨询不存在。", "The enquiry was not found.", 404);
  } catch (error) {
    console.error("Failed to load admin inquiry detail", error instanceof Error ? error.name : "UnknownError");
    return errorResponse("咨询详情暂时无法加载，请稍后重试。", "The enquiry detail could not be loaded right now.", 503);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ inquiryId: string }> }) {
  const access = await getTenantId(request);
  if ("error" in access) return access.error;
  if (!verifySameOriginRequest(request)) return errorResponse("请求来源无效。", "Invalid request origin.", 403);

  const { inquiryId: rawInquiryId } = await context.params;
  const inquiryId = parseInquiryId(rawInquiryId);
  if (inquiryId === null) return errorResponse("咨询编号无效。", "The enquiry ID is invalid.", 400);
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") return errorResponse("状态更新请求必须使用 JSON 格式。", "Status updates must use application/json.", 415);
  const rawBody = await readRequestBodyWithinLimit(request, ADMIN_INQUIRY_STATUS_BODY_MAX_BYTES);
  if (rawBody === null) return errorResponse("状态更新请求过大。", "The status update request is too large.", 413);

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return errorResponse("状态更新内容不是有效 JSON。", "The status update JSON is invalid.", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return errorResponse("状态更新内容格式不正确。", "The status update payload is invalid.", 400);
  const payload = body as Record<string, unknown>;
  if (Object.keys(payload).some((key) => key !== "status") || !isAdminInquiryStatus(payload.status)) return errorResponse("咨询状态无效。", "The enquiry status is invalid.", 400);

  try {
    const inquiry = await updateAdminInquiryStatus(access.tenantId, inquiryId, payload.status);
    return inquiry ? Response.json({ inquiry }, { headers: { "Cache-Control": "no-store" } }) : errorResponse("咨询不存在。", "The enquiry was not found.", 404);
  } catch (error) {
    console.error("Failed to update admin inquiry status", error instanceof Error ? error.name : "UnknownError");
    return errorResponse("咨询状态暂时无法更新，请稍后重试。", "The enquiry status could not be updated right now.", 503);
  }
}
