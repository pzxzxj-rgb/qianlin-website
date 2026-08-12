import type { Inquiry } from "../../../db/schema";

export type ErpProviderName = "disabled" | "mock" | "zhilv";
export type InquirySyncStatus = "pending" | "processing" | "synced" | "failed" | "not_configured" | "dead_letter";

export type CanonicalInquiry = Pick<Inquiry, "tenantId" | "name" | "phone" | "wechat" | "email" | "location" | "travelDate" | "travelers" | "duration" | "tourName" | "places" | "message"> & {
  inquiryId: number;
  idempotencyKey: string;
};

export type ErpProviderResult = { externalRecordId: string };

export interface ErpInquiryProvider {
  readonly name: ErpProviderName;
  createInquiry(input: CanonicalInquiry): Promise<ErpProviderResult>;
}

export class ErpProviderError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ErpProviderError";
    this.code = code;
  }
}
