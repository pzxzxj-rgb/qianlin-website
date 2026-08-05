import { requireAdminSession, requireAdminTenant } from "../../../../lib/admin/auth";
import { readRequestBodyWithinLimit, verifySameOriginRequest } from "../../../../lib/admin/requestSecurity";
import { updateAdminProfile, validateAdminProfilePayload } from "../../../../lib/admin/profile";

const ADMIN_PROFILE_BODY_MAX_BYTES = 16 * 1024;

function errorResponse(errorZh: string, errorEn: string, status: number, fieldErrors?: ReturnType<typeof validateAdminProfilePayload>["fieldErrors"]) {
  return Response.json({ errorZh, errorEn, ...(fieldErrors && Object.keys(fieldErrors).length > 0 ? { fieldErrors } : {}) }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const session = await requireAdminSession(request);
  if (!session) return errorResponse("登录状态已失效，请重新登录。", "Your admin session is invalid or expired.", 401);

  let tenantId: string;
  try {
    tenantId = requireAdminTenant(session);
  } catch {
    return errorResponse("当前管理员没有权限操作该租户。", "You are not allowed to edit this tenant.", 403);
  }

  if (!verifySameOriginRequest(request)) return errorResponse("请求来源无效。", "Invalid request origin.", 403);

  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") return errorResponse("资料保存请求必须使用 JSON 格式。", "Profile updates must use application/json.", 415);

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > ADMIN_PROFILE_BODY_MAX_BYTES) {
    return errorResponse("资料保存请求过大。", "Profile update request is too large.", 413);
  }

  const rawBody = await readRequestBodyWithinLimit(request, ADMIN_PROFILE_BODY_MAX_BYTES);
  if (rawBody === null) return errorResponse("资料保存请求过大。", "Profile update request is too large.", 413);

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return errorResponse("资料保存内容不是有效 JSON。", "Profile update JSON is invalid.", 400);
  }

  const validation = validateAdminProfilePayload(body);
  if (validation.invalidShape) return errorResponse("资料保存内容格式不正确。", "Profile update payload is invalid.", 400);
  if (validation.hasUnknownFields) return errorResponse("请求包含不支持的字段。", "Profile update contains unsupported fields.", 400);
  if (Object.keys(validation.fieldErrors).length > 0) return errorResponse("部分资料填写不正确。", "Some profile fields are invalid.", 400, validation.fieldErrors);

  try {
    const profile = await updateAdminProfile(tenantId, validation.values);
    if (!profile) return errorResponse("黔林旅行社正式资料不存在。", "The published Qianlin profile was not found.", 404);
    return Response.json({ profile }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to update admin profile", error instanceof Error ? error.name : "UnknownError");
    return errorResponse("资料暂时无法保存，请稍后重试。", "The profile could not be saved right now.", 503);
  }
}
