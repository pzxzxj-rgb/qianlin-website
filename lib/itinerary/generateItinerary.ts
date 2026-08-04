import { ItineraryGenerationError } from "./errors";
import { localItineraryProvider } from "./providers/localItineraryProvider";
import type { ItineraryPlan, ItineraryProviderName, ItineraryRequest } from "./types";

export function getConfiguredItineraryProvider(): ItineraryProviderName | string {
  if (typeof process === "undefined") return "local";
  return process.env.ITINERARY_PROVIDER || "local";
}

export async function generateItinerary(input: ItineraryRequest): Promise<ItineraryPlan> {
  const provider = getConfiguredItineraryProvider();

  switch (provider) {
    case "local":
      return localItineraryProvider.generate(input);
    case "external":
      throw new ItineraryGenerationError("EXTERNAL_PROVIDER_NOT_CONFIGURED", input.language === "zh" ? "外部行程服务尚未配置，请稍后重试或直接咨询旅行顾问。" : "The external itinerary service is not configured yet. Please try again later or contact a travel consultant.");
    default:
      throw new ItineraryGenerationError("UNSUPPORTED_PROVIDER", input.language === "zh" ? "当前行程规划服务配置不可用，请联系旅行顾问。" : "The current itinerary provider is not available. Please contact a travel consultant.");
  }
}
