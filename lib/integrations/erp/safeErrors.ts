const SAFE_ERROR_CODES = new Set([
  "ERP_NOT_CONFIGURED",
  "MOCK_PROVIDER_FAILURE",
  "INQUIRY_NOT_FOUND",
  "ERP_PROVIDER_ERROR",
]);

export function safeSyncErrorCode(value: unknown, fallback = "ERP_PROVIDER_ERROR") {
  return typeof value === "string" && SAFE_ERROR_CODES.has(value) ? value : fallback;
}

export function safeSyncErrorMessage(code: string) {
  if (code === "ERP_NOT_CONFIGURED") return "ERP provider is not configured.";
  if (code === "MOCK_PROVIDER_FAILURE") return "The configured test provider failed.";
  if (code === "INQUIRY_NOT_FOUND") return "The enquiry could not be found for this tenant.";
  return "The ERP synchronization attempt failed.";
}

export function safeSyncError(status: string, code: unknown) {
  if (status !== "failed" && status !== "not_configured") return { errorCode: null, message: null };
  const errorCode = safeSyncErrorCode(code, status === "not_configured" ? "ERP_NOT_CONFIGURED" : "ERP_PROVIDER_ERROR");
  return { errorCode, message: safeSyncErrorMessage(errorCode) };
}
