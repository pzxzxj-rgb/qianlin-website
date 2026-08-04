export type ItineraryErrorCode =
  | "INVALID_INPUT"
  | "NO_VALID_DESTINATIONS"
  | "UNSUPPORTED_PROVIDER"
  | "EXTERNAL_PROVIDER_NOT_CONFIGURED";

export class ItineraryGenerationError extends Error {
  constructor(public readonly code: ItineraryErrorCode, message: string) {
    super(message);
    this.name = "ItineraryGenerationError";
  }
}
