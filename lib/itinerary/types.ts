import type { PlannerCityOption, PlannerDestinationOption } from "../planner/types";

export type ItineraryLanguage = "zh" | "en";
export type ItineraryTravelers = "1" | "2" | "3-5" | "6+";

export type LocalizedItineraryText = {
  zh: string;
  en: string;
};

export type ItineraryRequest = {
  tenantId: string;
  destinationIds: string[];
  days: number;
  travelers: ItineraryTravelers;
  startCity: string;
  endCity: string;
  language: ItineraryLanguage;
};

export type ItineraryGenerationContext = {
  cities: PlannerCityOption[];
  destinations: PlannerDestinationOption[];
};

export type ItineraryStop = {
  destinationId: string;
  name: LocalizedItineraryText;
};

export type ItineraryDay = {
  day: number;
  title: LocalizedItineraryText;
  region: string;
  stops: ItineraryStop[];
  overnightSuggestion?: LocalizedItineraryText;
  note?: LocalizedItineraryText;
};

export type ItineraryPlan = {
  id: string;
  input: ItineraryRequest;
  days: ItineraryDay[];
  warnings: string[];
  unassignedDestinationIds: string[];
  generatedBy: "local" | "external";
};

export interface ItineraryProvider {
  generate(input: ItineraryRequest, context: ItineraryGenerationContext): Promise<ItineraryPlan>;
}

export type ItineraryProviderName = "local" | "external";
