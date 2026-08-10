import { ErpProviderError, type CanonicalInquiry, type ErpInquiryProvider, type ErpProviderResult } from "../types";

export class DisabledErpProvider implements ErpInquiryProvider {
  readonly name: "disabled" | "zhilv";

  constructor(name: "disabled" | "zhilv" = "disabled") {
    this.name = name;
  }

  async createInquiry(input: CanonicalInquiry): Promise<ErpProviderResult> {
    void input;
    throw new ErpProviderError("ERP_NOT_CONFIGURED", "No ERP provider is configured.");
  }
}
