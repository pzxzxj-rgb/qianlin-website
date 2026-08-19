import { DisabledErpProvider } from "./disabled/DisabledErpProvider";
import { MockErpProvider } from "./mock/MockErpProvider";
import { assertTenantScope } from "../../admin/tenantScope";
import { getAppEnvironment } from "../../runtime/environment";
import type { ErpInquiryProvider, ErpProviderName } from "./types";

async function readWorkerProvider() {
  try {
    const { env } = await import("cloudflare:workers");
    const value = (env as unknown as Record<string, unknown>).ERP_PROVIDER;
    return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : "";
  } catch {
    return "";
  }
}

export async function configuredProviderName(trustedTenantId: string): Promise<ErpProviderName> {
  assertTenantScope(trustedTenantId);
  const appEnv = await getAppEnvironment();
  const workerValue = await readWorkerProvider();
  const processValue = typeof process !== "undefined" ? process.env.ERP_PROVIDER?.trim().toLowerCase() ?? "" : "";
  const provider = workerValue || processValue;

  if (provider === "mock") {
    if (appEnv === "production") {
      throw new Error("ERP_PROVIDER=mock is forbidden in production.");
    }
    return "mock";
  }
  if (provider === "zhilv") return "zhilv";
  return "disabled";
}

export async function getErpInquiryProvider(trustedTenantId: string): Promise<ErpInquiryProvider> {
  assertTenantScope(trustedTenantId);
  const name = await configuredProviderName(trustedTenantId);
  if (name === "mock") return new MockErpProvider();
  if (name === "zhilv") return new DisabledErpProvider("zhilv");
  return new DisabledErpProvider();
}
