import { requireAdminSession, requireAdminTenant } from "../../../../lib/admin/auth";
import { readAdminJsonRequest } from "../../../../lib/admin/imageRequest";
import { AdminTourConflictError, createAdminTour, getAdminTours, validateAdminTourPayload } from "../../../../lib/admin/tours";

const ADMIN_TOURS_BODY_MAX_BYTES = 48 * 1024;

function errorResponse(errorZh: string, errorEn: string, status: number, fieldErrors?: Record<string, string>) {
  return Response.json({ errorZh, errorEn, ...(fieldErrors && Object.keys(fieldErrors).length > 0 ? { fieldErrors } : {}) }, { status, headers: { "Cache-Control": "no-store" } });
}

async function getTrustedAdminTenant(request: Request) {
  const session = await requireAdminSession(request);
  if (!session) return { response: errorResponse("登录状态已失效，请重新登录。", "Your admin session is invalid or expired.", 401) } as const;
  try {
    return { tenantId: requireAdminTenant(session) } as const;
  } catch {
    return { response: errorResponse("当前管理员没有权限操作该租户。", "You are not allowed to edit this tenant.", 403) } as const;
  }
}

export async function GET(request: Request) {
  const trusted = await getTrustedAdminTenant(request);
  if ("response" in trusted) return trusted.response;

  try {
    const tours = await getAdminTours(trusted.tenantId);
    return Response.json({ tours }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to load admin tours", error instanceof Error ? error.name : "UnknownError");
    return errorResponse("旅游线路暂时无法加载，请稍后重试。", "Tours could not be loaded right now.", 503);
  }
}

export async function POST(request: Request) {
  const parsed = await readAdminJsonRequest(request, ADMIN_TOURS_BODY_MAX_BYTES, "旅游线路");
  if ("response" in parsed) return parsed.response;

  const validation = validateAdminTourPayload(parsed.body);
  if (validation.invalidShape) return errorResponse("线路资料格式不正确。", "Tour payload is invalid.", 400, validation.fieldErrors);
  if (validation.hasUnknownFields) return errorResponse("请求包含不支持的字段。", "Tour request contains unsupported fields.", 400, validation.fieldErrors);
  if (Object.keys(validation.fieldErrors).length > 0) return errorResponse("部分线路资料填写不正确。", "Some tour fields are invalid.", 400, validation.fieldErrors);

  try {
    const tour = await createAdminTour(parsed.tenantId, validation.values);
    return Response.json({ tour }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AdminTourConflictError) return errorResponse("当前租户已经存在相同 slug 的线路。", "This tenant already has a tour with the same slug.", 409);
    console.error("Failed to create admin tour", error instanceof Error ? error.name : "UnknownError");
    return errorResponse("旅游线路暂时无法保存，请稍后重试。", "The tour could not be saved right now.", 503);
  }
}
