import { readAdminJsonRequest } from "../../../../../lib/admin/imageRequest";
import { AdminTourConflictError, AdminTourNotFoundError, updateAdminTour, validateAdminTourPayload } from "../../../../../lib/admin/tours";

const ADMIN_TOUR_BODY_MAX_BYTES = 48 * 1024;

function errorResponse(errorZh: string, errorEn: string, status: number, fieldErrors?: Record<string, string>) {
  return Response.json({ errorZh, errorEn, ...(fieldErrors && Object.keys(fieldErrors).length > 0 ? { fieldErrors } : {}) }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request, context: { params: Promise<{ tourId: string }> }) {
  const { tourId } = await context.params;
  if (!tourId || tourId.length > 160 || /[\u0000-\u001F\u007F]/.test(tourId)) return errorResponse("线路不存在或不可用。", "The tour does not exist or is unavailable.", 404);

  const parsed = await readAdminJsonRequest(request, ADMIN_TOUR_BODY_MAX_BYTES, "旅游线路");
  if ("response" in parsed) return parsed.response;

  const validation = validateAdminTourPayload(parsed.body);
  if (validation.invalidShape) return errorResponse("线路资料格式不正确。", "Tour payload is invalid.", 400, validation.fieldErrors);
  if (validation.hasUnknownFields) return errorResponse("请求包含不支持的字段。", "Tour request contains unsupported fields.", 400, validation.fieldErrors);
  if (Object.keys(validation.fieldErrors).length > 0) return errorResponse("部分线路资料填写不正确。", "Some tour fields are invalid.", 400, validation.fieldErrors);

  try {
    const tour = await updateAdminTour(parsed.tenantId, tourId, validation.values);
    return Response.json({ tour }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AdminTourNotFoundError) return errorResponse("线路不存在或不可用。", "The tour does not exist or is unavailable.", 404);
    if (error instanceof AdminTourConflictError) return errorResponse("当前租户已经存在相同 slug 的线路。", "This tenant already has a tour with the same slug.", 409);
    console.error("Failed to update admin tour", error instanceof Error ? error.name : "UnknownError");
    return errorResponse("旅游线路暂时无法保存，请稍后重试。", "The tour could not be saved right now.", 503);
  }
}
