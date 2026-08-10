import { readAdminJsonRequest } from "../../../../lib/admin/imageRequest";
import { AdminDestinationCityError, AdminDestinationConflictError, createAdminDestination, getAdminDestinationBundle, validateAdminDestinationPayload } from "../../../../lib/admin/destinations";
import { getAdminRouteAccess } from "../../../../lib/admin/routeAccess";
import { recordAdminAudit } from "../../../../lib/admin/audit";

const ADMIN_DESTINATION_BODY_MAX_BYTES = 64 * 1024;

function errorResponse(errorZh: string, errorEn: string, status: number, fieldErrors?: Record<string, string>) {
  return Response.json({ errorZh, errorEn, ...(fieldErrors && Object.keys(fieldErrors).length > 0 ? { fieldErrors } : {}) }, { status, headers: { "Cache-Control": "no-store" } });
}

async function getTrustedAdminTenant(request: Request) {
  const trusted = await getAdminRouteAccess(request, undefined, "viewer");
  return "response" in trusted ? trusted : { tenantId: trusted.access.tenantId };
}

export async function GET(request: Request) {
  const trusted = await getTrustedAdminTenant(request);
  if ("response" in trusted) return trusted.response;
  try {
    const bundle = await getAdminDestinationBundle(trusted.tenantId);
    return Response.json(bundle, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to load admin destinations", error instanceof Error ? error.name : "UnknownError");
    return errorResponse("目的地暂时无法加载，请稍后重试。", "Destinations could not be loaded right now.", 503);
  }
}

export async function POST(request: Request) {
  const parsed = await readAdminJsonRequest(request, ADMIN_DESTINATION_BODY_MAX_BYTES, "目的地");
  if ("response" in parsed) return parsed.response;
  const validation = validateAdminDestinationPayload(parsed.body);
  if (validation.invalidShape) return errorResponse("目的地资料格式不正确。", "Destination payload is invalid.", 400, validation.fieldErrors);
  if (validation.hasUnknownFields) return errorResponse("请求包含不支持的字段。", "Destination request contains unsupported fields.", 400, validation.fieldErrors);
  if (Object.keys(validation.fieldErrors).length > 0) return errorResponse("部分目的地资料填写不正确。", "Some destination fields are invalid.", 400, validation.fieldErrors);
  try {
    const destination = await createAdminDestination(parsed.tenantId, validation.values);
    await recordAdminAudit({ tenantId: parsed.tenantId, userId: parsed.userId, action: "create", resourceType: "destination", resourceId: destination.id, result: "success" }).catch(() => undefined);
    return Response.json({ destination }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AdminDestinationConflictError) return errorResponse("当前租户已经存在相同 slug 的目的地。", "This tenant already has a destination with the same slug.", 409);
    if (error instanceof AdminDestinationCityError) return errorResponse("请选择当前租户可用的城市。", "Choose an available city for this tenant.", 400, { cityCode: "所属城市不可用。" });
    console.error("Failed to create admin destination", error instanceof Error ? error.name : "UnknownError");
    return errorResponse("目的地暂时无法保存，请稍后重试。", "The destination could not be saved right now.", 503);
  }
}
