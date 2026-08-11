import { ErpProviderError, type CanonicalInquiry, type ErpInquiryProvider } from "../types";

export class MockErpProvider implements ErpInquiryProvider {
  readonly name = "mock" as const;

  async createInquiry(input: CanonicalInquiry) {
    let failure = typeof process !== "undefined" && process.env.ERP_MOCK_FAILURE === "true";
    try {
      const { env } = await import("cloudflare:workers");
      failure ||= String((env as unknown as Record<string, unknown>).ERP_MOCK_FAILURE ?? "").trim().toLowerCase() === "true";
    } catch {
      // Node-only tests use process.env.
    }
    if (failure) throw new ErpProviderError("MOCK_PROVIDER_FAILURE", "The mock ERP provider was configured to fail.");
    return { externalRecordId: `mock-${input.inquiryId}` };
  }
}
