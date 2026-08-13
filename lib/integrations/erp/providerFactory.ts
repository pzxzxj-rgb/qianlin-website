import { DisabledErpProvider } from "./disabled/DisabledErpProvider";
import { MockErpProvider } from "./mock/MockErpProvider";
import { assertTenantScope } from "../../admin/tenantScope";
import type { ErpInquiryProvider, ErpProviderName } from "./types";

function isProductionRuntime() {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "production") return true;
  return false;
}

export async function configuredProviderName(trustedTenantId: string): Promise<ErpProviderName> {
  assertTenantScope(trustedTenantId);
  const processValue = typeof process !== "undefined" ? process.env.ERP_PROVIDER?.trim().toLowerCase() : "";
  try {
    const { env } = await import("cloudflare:workers");
    const runtime = env as unknown as Record<string, unknown>;
    const workerProduction = [runtime.NODE_ENV, runtime.ENVIRONMENT, runtime.APP_ENV].some((value) => String(value ?? "").trim().toLowerCase() === "production");
    const value = String(runtime.ERP_PROVIDER ?? "").trim().toLowerCase();
    // In a bundled Worker, process.env can reflect build-time mode rather than
    // the executing Worker's environment. Prefer the trusted runtime binding
    // when it is present, while still refusing mock in a production Worker.
    if (value === "mock") return workerProduction ? "disabled" : "mock";
    if (value === "zhilv") return "zhilv";
  } catch {
    // Local tests and ordinary Node callers use the disabled provider by default.
  }
  const processProduction = isProductionRuntime();
  if (processValue === "mock" && !processProduction) return "mock";
  if (processValue === "zhilv") return "zhilv";
  return "disabled";
}

export async function getErpInquiryProvider(trustedTenantId: string): Promise<ErpInquiryProvider> {
  assertTenantScope(trustedTenantId);
  const name = await configuredProviderName(trustedTenantId);
  if (name === "mock") return new MockErpProvider();
  if (name === "zhilv") return new DisabledErpProvider("zhilv");
  return new DisabledErpProvider();
}
