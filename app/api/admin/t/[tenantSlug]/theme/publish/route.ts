import { readAdminJsonRequest } from "@/lib/admin/imageRequest";
import { recordAdminAudit } from "@/lib/admin/audit";
import { publishAdminTheme } from "@/lib/admin/theme";

async function writeThemeAudit(input: Parameters<typeof recordAdminAudit>[0]) {
  try {
    await recordAdminAudit(input);
  } catch (error) {
    console.error("Failed to record theme audit", error instanceof Error ? error.name : "UnknownError");
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const parsed = await readAdminJsonRequest(request, 1_024, "Theme publish", tenantSlug, "admin", "theme:publish");
  if ("response" in parsed) return parsed.response;
  if (!parsed.body || typeof parsed.body !== "object" || Array.isArray(parsed.body) || Object.keys(parsed.body as object).length !== 0) {
    return Response.json({ errorZh: "发布请求不接受额外字段。", errorEn: "Publish requests do not accept extra fields." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const result = await publishAdminTheme(parsed.tenantId, parsed.userId);
    await writeThemeAudit({ tenantId: parsed.tenantId, userId: parsed.userId, action: "theme_publish", resourceType: "tenant_theme", resourceId: result.state.published.id, result: "success", metadata: { template: result.state.published.values.templateKey, previousVersion: result.previousVersion, newVersion: result.newVersion } });
    return Response.json(result.state, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await writeThemeAudit({ tenantId: parsed.tenantId, userId: parsed.userId, action: "theme_publish", resourceType: "tenant_theme", result: "failure", metadata: { reason: error instanceof Error ? error.name : "UnknownError" } });
    console.error("Failed to publish admin theme", error instanceof Error ? error.name : "UnknownError");
    return Response.json({ errorZh: "主题发布失败。", errorEn: "Theme could not be published." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
