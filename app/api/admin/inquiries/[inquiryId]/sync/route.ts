import { getCurrentInquirySyncJob, retryCurrentInquirySyncJob } from "../../../../../../lib/inquiries/syncService";
import { getAdminRouteAccess } from "../../../../../../lib/admin/routeAccess";
import { readRequestBodyWithinLimit, verifySameOriginRequest } from "../../../../../../lib/admin/requestSecurity";
import { recordAdminAudit } from "../../../../../../lib/admin/audit";
import { safeSyncError } from "../../../../../../lib/integrations/erp/safeErrors";
import { configuredProviderName } from "../../../../../../lib/integrations/erp/providerFactory";

function errorResponse(errorZh: string, errorEn: string, status: number) {
  return Response.json({ errorZh, errorEn }, { status, headers: { "Cache-Control": "no-store" } });
}

function parseInquiryId(value: string) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function POST(request: Request, context: { params: Promise<{ inquiryId: string }> }) {
  const trusted = await getAdminRouteAccess(request, undefined, "admin", "inquiry:sync_retry");
  if ("response" in trusted) return trusted.response;
  if (!verifySameOriginRequest(request)) return errorResponse("请求来源无效。", "Invalid request origin.", 403);

  const { inquiryId: rawInquiryId } = await context.params;
  const inquiryId = parseInquiryId(rawInquiryId);
  if (inquiryId === null) return errorResponse("咨询编号无效。", "The enquiry ID is invalid.", 400);
  const rawBody = await readRequestBodyWithinLimit(request, 4 * 1024);
  if (rawBody === null) return errorResponse("重试请求过大。", "The retry request is too large.", 413);
  if (rawBody.trim()) {
    let body: unknown;
    try { body = JSON.parse(rawBody); } catch { return errorResponse("重试请求格式无效。", "The retry request is invalid.", 400); }
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body as Record<string, unknown>).length > 0) return errorResponse("重试请求不支持自定义租户或 Provider 字段。", "The retry request does not accept tenant or provider fields.", 400);
  }

  try {
    const configuredProvider = await configuredProviderName(trusted.access.tenantId);
    const beforeRetry = await getCurrentInquirySyncJob(trusted.access.tenantId, inquiryId);
    if (configuredProvider === "disabled" || configuredProvider === "zhilv" || beforeRetry?.status === "not_configured") {
      await recordAdminAudit({ tenantId: trusted.access.tenantId, userId: trusted.access.userId, action: "sync_retry", resourceType: "inquiry_sync_job", resourceId: beforeRetry?.id ?? String(inquiryId), result: "failure", metadata: { reason: "erp_not_configured" } });
      return errorResponse("当前租户未配置 ERP 同步。", "ERP synchronization is not configured for this tenant.", 409);
    }
    if (beforeRetry?.status === "synced") {
      await recordAdminAudit({ tenantId: trusted.access.tenantId, userId: trusted.access.userId, action: "sync_retry", resourceType: "inquiry_sync_job", resourceId: beforeRetry.id, result: "failure", metadata: { reason: "already_synced" } });
      return errorResponse("该 Provider 已完成同步，无需重复重试。", "This provider job is already synced and cannot be retried.", 409);
    }
    const job = await retryCurrentInquirySyncJob(trusted.access.tenantId, inquiryId);
    if (!job) return errorResponse("同步任务不存在。", "The synchronization job was not found.", 404);
    await recordAdminAudit({ tenantId: trusted.access.tenantId, userId: trusted.access.userId, action: "sync_retry", resourceType: "inquiry_sync_job", resourceId: job.id, result: "success", metadata: { provider: job.provider, status: job.status } });
    const safeError = safeSyncError(job.status, job.lastErrorCode);
    return Response.json({ sync: { provider: job.provider, status: job.status, externalRecordId: job.status === "synced" ? job.externalRecordId : null, errorCode: safeError.errorCode, message: safeError.message } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "Inquiry does not belong to tenant") return errorResponse("同步任务不存在。", "The synchronization job was not found.", 404);
    try { await recordAdminAudit({ tenantId: trusted.access.tenantId, userId: trusted.access.userId, action: "sync_retry", resourceType: "inquiry_sync_job", resourceId: String(inquiryId), result: "failure", metadata: { reason: error instanceof Error ? error.name : "UnknownError" } }); } catch (auditError) { console.error("Failed to record inquiry retry audit", auditError instanceof Error ? auditError.name : "UnknownError"); }
    return errorResponse("同步任务暂时无法处理，请稍后重试。", "The synchronization job could not be processed right now.", 503);
  }
}
