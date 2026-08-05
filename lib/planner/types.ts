export type PlannerStatus = "draft" | "published" | "archived";

export type PlannerProvinceOption = {
  id: string;
  code: string;
  name: { zh: string; en: string };
  displayOrder: number;
};

export type PlannerCityOption = {
  id: string;
  provinceCode: string;
  code: string;
  name: { zh: string; en: string };
  availableAsStart: boolean;
  availableAsEnd: boolean;
  displayOrder: number;
};

export type PlannerDestinationOption = {
  id: string;
  provinceCode: string;
  slug: string;
  cityCode?: string;
  name: { zh: string; en: string };
  description: { zh: string; en: string };
  imageUrl: string;
  cardSize: "large" | "small";
  region: { zh: string; en: string };
  overnightSuggestion?: { zh: string; en: string };
  routeOrder: number;
  recommendedVisitHours?: number;
  majorAttraction: boolean;
  availableForPlanning: boolean;
  showOnHomepage: boolean;
  displayOrder: number;
};

export type PlannerOptionsResponse = {
  tenantId: string;
  tenantSlug: string;
  provinces: PlannerProvinceOption[];
  cities: PlannerCityOption[];
  destinations: PlannerDestinationOption[];
};

export type PlannerOptionsLoadState = "idle" | "loading" | "success" | "error";
