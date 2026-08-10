import { DisabledErpProvider } from "./disabled/DisabledErpProvider";
import { MockErpProvider } from "./mock/MockErpProvider";
import type { ErpInquiryProvider, ErpProviderName } from "./types";

async function configuredProviderName(): Promise<ErpProviderName> {
  const processValue = typeof process !== "undefined" ? process.env.ERP_PROVIDER?.trim().toLowerCase() : "";
  if (processValue === "mock" || processValue === "zhilv") return processValue;
  try {
    const { env } = await import("cloudflare:workers");
    const value = String((env as unknown as Record<string, unknown>).ERP_PROVIDER ?? "").trim().toLowerCase();
    if (value === "mock" || value === "zhilv") return value;
  } catch {
    // Local tests and ordinary Node callers use the disabled provider by default.
  }
  return "disabled";
}

export async function getErpInquiryProvider(): Promise<ErpInquiryProvider> {
  const name = await configuredProviderName();
  if (name === "mock") return new MockErpProvider();
  if (name === "zhilv") return new DisabledErpProvider("zhilv");
  return new DisabledErpProvider();
}

export { configuredProviderName };
