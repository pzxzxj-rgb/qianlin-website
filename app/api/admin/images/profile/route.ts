import { readAdminJsonRequest } from "../../../../../lib/admin/imageRequest";
import { updateAdminProfileImages, validateAdminProfileImagesPayload } from "../../../../../lib/admin/images";

const ADMIN_PROFILE_IMAGES_BODY_MAX_BYTES = 16 * 1024;

function errorResponse(errorZh: string, errorEn: string, status: number, fieldErrors?: Record<string, string>) {
  return Response.json({ errorZh, errorEn, ...(fieldErrors && Object.keys(fieldErrors).length > 0 ? { fieldErrors } : {}) }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const parsed = await readAdminJsonRequest(request, ADMIN_PROFILE_IMAGES_BODY_MAX_BYTES);
  if ("response" in parsed) return parsed.response;

  const validation = validateAdminProfileImagesPayload(parsed.body);
  if (validation.invalidShape) return errorResponse("图片资料格式不正确。", "Image profile payload is invalid.", 400);
  if (validation.hasUnknownFields) return errorResponse("请求包含不支持的字段。", "Image profile contains unsupported fields.", 400);
  if (Object.keys(validation.fieldErrors).length > 0) return errorResponse("部分图片资料填写不正确。", "Some image fields are invalid.", 400, validation.fieldErrors);

  try {
    const profile = await updateAdminProfileImages(parsed.tenantId, validation.values);
    if (!profile) return errorResponse("黔林旅行社正式资料不存在。", "The published Qianlin profile was not found.", 404);
    return Response.json({ profile }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to update admin profile images", error instanceof Error ? error.name : "UnknownError");
    return errorResponse("图片资料暂时无法保存，请稍后重试。", "Profile images could not be saved right now.", 503);
  }
}
