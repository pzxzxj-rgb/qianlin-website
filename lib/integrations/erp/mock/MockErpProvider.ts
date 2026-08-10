import { ErpProviderError, type CanonicalInquiry, type ErpInquiryProvider } from "../types";

export class MockErpProvider implements ErpInquiryProvider {
  readonly name = "mock" as const;

  async createInquiry(input: CanonicalInquiry) {
    if (typeof process !== "undefined" && process.env.ERP_MOCK_FAILURE === "true") throw new ErpProviderError("MOCK_PROVIDER_FAILURE", "The mock ERP provider was configured to fail.");
    return { externalRecordId: `mock-${input.inquiryId}` };
  }
}
