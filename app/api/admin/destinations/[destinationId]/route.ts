import { readAdminJsonRequest } from "../../../../../lib/admin/imageRequest";
import { AdminDestinationCityError, AdminDestinationConflictError, AdminDestinationImageError, AdminDestinationNotFoundError, updateAdminDestination, validateAdminDestinationPayload } from "../../../../../lib/admin/destinations";
import { recordAdminAudit } from "../../../../../lib/admin/audit";

const ADMIN_DESTINATION_BODY_MAX_BYTES = 64 * 1024;

function errorResponse(errorZh: string, errorEn: string, status: number, fieldErrors?: Record<string, string>) {
  return Response.json({ errorZh, errorEn, ...(fieldErrors && Object.keys(fieldErrors).length > 0 ? { fieldErrors } : {}) }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request, context: { params: Promise<{ destinationId: string }> }) {
  const { destinationId } = await context.params;
  if (!destinationId || destinationId.length > 160 || /[\u0000-\u001F\u007F]/.test(destinationId)) return errorResponse("目的地不存在或不可用。", "The destination does not exist or is unavailable.", 404);
  const parsed = await readAdminJsonRequest(request, ADMIN_DESTINATION_BODY_MAX_BYTES, "目的地");
  if ("response" in parsed) return parsed.response;
  const validation = validateAdminDestinationPayload(parsed.body);
  if (validation.invalidShape) return errorResponse("目的地资料格式不正确。", "Destination payload is invalid.", 400, validation.fieldErrors);
  if (validation.hasUnknownFields) return errorResponse("请求包含不支持的字段。", "Destination request contains unsupported fields.", 400, validation.fieldErrors);
  if (Object.keys(validation.fieldErrors).length > 0) return errorResponse("部分目的地资料填写不正确。", "Some destination fields are invalid.", 400, validation.fieldErrors);
  try {
    const destination = await updateAdminDestination(parsed.tenantId, destinationId, validation.values);
    await recordAdminAudit({ tenantId: parsed.tenantId, userId: parsed.userId, action: "update", resourceType: "destination", resourceId: destination.id, result: "success" }).catch(() => undefined);
    return Response.json({ destination }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AdminDestinationNotFoundError) return errorResponse("目的地不存在或不可用。", "The destination does not exist or is unavailable.", 404);
    if (error instanceof AdminDestinationConflictError) return errorResponse("当前租户已经存在相同 slug 的目的地。", "This tenant already has a destination with the same slug.", 409);
    if (error instanceof AdminDestinationCityError) return errorResponse("请选择当前租户可用的城市。", "Choose an available city for this tenant.", 400, { cityCode: "所属城市不可用。" });
    if (error instanceof AdminDestinationImageError) return errorResponse("没有安全的本地首页图片，不能开启首页展示。", "A safe local homepage image is required before this destination can be shown on the homepage.", 400, { showOnHomepage: "没有安全的本地首页图片，不能开启首页展示。" });
    console.error("Failed to update admin destination", error instanceof Error ? error.name : "UnknownError");
    return errorResponse("目的地暂时无法保存，请稍后重试。", "The destination could not be saved right now.", 503);
  }
}
