import { readAdminJsonRequest } from "@/lib/admin/imageRequest";
import { recordAdminAudit } from "@/lib/admin/audit";
import { resetAdminThemeDraft } from "@/lib/admin/theme";

async function writeThemeAudit(input: Parameters<typeof recordAdminAudit>[0]) {
  try {
    await recordAdminAudit(input);
  } catch (error) {
    console.error("Failed to record theme audit", error instanceof Error ? error.name : "UnknownError");
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const parsed = await readAdminJsonRequest(request, 1_024, "Theme reset", tenantSlug, "editor", "theme:update_draft");
  if ("response" in parsed) return parsed.response;
  if (!parsed.body || typeof parsed.body !== "object" || Array.isArray(parsed.body) || Object.keys(parsed.body as object).length !== 0) {
    return Response.json({ errorZh: "重置请求不接受额外字段。", errorEn: "Reset requests do not accept extra fields." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const draft = await resetAdminThemeDraft(parsed.tenantId);
    await writeThemeAudit({ tenantId: parsed.tenantId, userId: parsed.userId, action: "theme_draft_reset", resourceType: "tenant_theme", resourceId: draft.id, result: "success", metadata: { version: draft.version } });
    return Response.json(draft, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await writeThemeAudit({ tenantId: parsed.tenantId, userId: parsed.userId, action: "theme_draft_reset", resourceType: "tenant_theme", result: "failure", metadata: { reason: error instanceof Error ? error.name : "UnknownError" } });
    console.error("Failed to reset admin theme draft", error instanceof Error ? error.name : "UnknownError");
    return Response.json({ errorZh: "主题草稿重置失败。", errorEn: "Theme draft could not be reset." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
