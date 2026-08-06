import { requireAdminSession, requireAdminTenant } from "../../../../lib/admin/auth";
import { readAdminJsonRequest } from "../../../../lib/admin/imageRequest";
import { AdminContactConfigurationError, getAdminContacts, updateAdminContacts, validateAdminContactsPayload } from "../../../../lib/admin/contacts";

const ADMIN_CONTACTS_BODY_MAX_BYTES = 24 * 1024;

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
    const contacts = await getAdminContacts(trusted.tenantId);
    return Response.json({ contacts }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to load admin contacts", error instanceof Error ? error.name : "UnknownError");
    return errorResponse("联系方式暂时无法加载，请稍后重试。", "Contacts could not be loaded right now.", 503);
  }
}

export async function PUT(request: Request) {
  const parsed = await readAdminJsonRequest(request, ADMIN_CONTACTS_BODY_MAX_BYTES, "联系方式");
  if ("response" in parsed) return parsed.response;

  const validation = validateAdminContactsPayload(parsed.body);
  if (validation.invalidShape) return errorResponse("联系方式资料格式不正确。", "Contact payload is invalid.", 400, validation.fieldErrors);
  if (validation.hasUnknownFields) return errorResponse("请求包含不支持的字段。", "Contact update contains unsupported fields.", 400, validation.fieldErrors);
  if (Object.keys(validation.fieldErrors).length > 0) return errorResponse("部分联系方式填写不正确。", "Some contact fields are invalid.", 400, validation.fieldErrors);

  try {
    const contacts = await updateAdminContacts(parsed.tenantId, validation.values);
    return Response.json({ contacts }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AdminContactConfigurationError) return errorResponse("联系方式配置已发生变化，请刷新后重试。", "The contact configuration changed. Refresh and try again.", 409);
    console.error("Failed to update admin contacts", error instanceof Error ? error.name : "UnknownError");
    return errorResponse("联系方式暂时无法保存，请稍后重试。", "Contacts could not be saved right now.", 503);
  }
}
