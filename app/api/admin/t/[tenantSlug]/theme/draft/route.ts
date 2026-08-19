import { readAdminJsonRequest } from "@/lib/admin/imageRequest";
import { recordAdminAudit } from "@/lib/admin/audit";
import { getAdminThemeState, updateAdminThemeDraft, validateAdminThemeDraftPayload } from "@/lib/admin/theme";

const THEME_BODY_MAX_BYTES = 8_192;

function errorResponse(errorZh: string, errorEn: string, status: number, fieldErrors?: Record<string, string>) {
  return Response.json({ errorZh, errorEn, ...(fieldErrors ? { fieldErrors } : {}) }, { status, headers: { "Cache-Control": "no-store" } });
}

async function writeThemeAudit(input: Parameters<typeof recordAdminAudit>[0]) {
  try {
    await recordAdminAudit(input);
  } catch (error) {
    console.error("Failed to record theme audit", error instanceof Error ? error.name : "UnknownError");
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const parsed = await readAdminJsonRequest(request, THEME_BODY_MAX_BYTES, "Theme", tenantSlug, "editor", "theme:update_draft");
  if ("response" in parsed) return parsed.response;
  const validation = validateAdminThemeDraftPayload(parsed.body);
  if (validation.invalidShape || validation.hasUnknownFields || Object.keys(validation.fieldErrors).length > 0) {
    return errorResponse("主题配置字段不合法。", "Theme configuration fields are invalid.", 400, validation.fieldErrors);
  }

  try {
    const draft = await updateAdminThemeDraft(parsed.tenantId, validation.values);
    await writeThemeAudit({ tenantId: parsed.tenantId, userId: parsed.userId, action: "theme_draft_update", resourceType: "tenant_theme", resourceId: draft.id, result: "success", metadata: { template: draft.values.templateKey, version: draft.version } });
    return Response.json(await getAdminThemeState(parsed.tenantId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await writeThemeAudit({ tenantId: parsed.tenantId, userId: parsed.userId, action: "theme_draft_update", resourceType: "tenant_theme", result: "failure", metadata: { reason: error instanceof Error ? error.name : "UnknownError" } });
    console.error("Failed to update admin theme draft", error instanceof Error ? error.name : "UnknownError");
    return errorResponse("主题草稿保存失败。", "Theme draft could not be saved.", 500);
  }
}
