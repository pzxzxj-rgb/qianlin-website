import { readAdminJsonRequest } from "../../../../../lib/admin/imageRequest";
import { AdminImageConfigurationError, updateAdminHeroImages, validateAdminHeroImagesPayload } from "../../../../../lib/admin/images";

const ADMIN_HERO_IMAGES_BODY_MAX_BYTES = 24 * 1024;

function errorResponse(errorZh: string, errorEn: string, status: number, fieldErrors?: Record<string, string>) {
  return Response.json({ errorZh, errorEn, ...(fieldErrors && Object.keys(fieldErrors).length > 0 ? { fieldErrors } : {}) }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const parsed = await readAdminJsonRequest(request, ADMIN_HERO_IMAGES_BODY_MAX_BYTES);
  if ("response" in parsed) return parsed.response;

  const validation = validateAdminHeroImagesPayload(parsed.body);
  if (validation.invalidShape) return errorResponse("Hero 图片资料格式不正确。", "Hero image payload is invalid.", 400);
  if (validation.hasUnknownFields) return errorResponse("请求包含不支持的字段。", "Hero image contains unsupported fields.", 400);
  if (Object.keys(validation.fieldErrors).length > 0) return errorResponse("部分 Hero 图片资料填写不正确。", "Some Hero image fields are invalid.", 400, validation.fieldErrors);

  try {
    const heroSlides = await updateAdminHeroImages(parsed.tenantId, validation.values.slides);
    return Response.json({ heroSlides }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AdminImageConfigurationError) return errorResponse("Hero 图片配置必须正好包含两张已发布图片。", "The published Hero configuration must contain exactly two images.", 409);
    console.error("Failed to update admin hero images", error instanceof Error ? error.name : "UnknownError");
    return errorResponse("Hero 图片暂时无法保存，请稍后重试。", "Hero images could not be saved right now.", 503);
  }
}
