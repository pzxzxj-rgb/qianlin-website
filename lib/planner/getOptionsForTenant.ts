import { asc, and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { plannerCities, plannerDestinations, plannerProvinces } from "../../db/schema";
import type { PlannerOptionsResponse } from "./types";

type TenantKey = { id: string };

export async function getPlannerOptionsForTenant(tenant: TenantKey): Promise<PlannerOptionsResponse> {
  const db = await getDb();
  const [cityRows, destinationRows] = await Promise.all([
    db.select({
      id: plannerCities.id,
      provinceCode: plannerCities.provinceCode,
      code: plannerCities.code,
      nameZh: plannerCities.nameZh,
      nameEn: plannerCities.nameEn,
      availableAsStart: plannerCities.availableAsStart,
      availableAsEnd: plannerCities.availableAsEnd,
      displayOrder: plannerCities.displayOrder,
    }).from(plannerCities).where(and(eq(plannerCities.tenantId, tenant.id), eq(plannerCities.status, "published"))).orderBy(asc(plannerCities.displayOrder), asc(plannerCities.id)),
    db.select({
      id: plannerDestinations.id,
      provinceCode: plannerDestinations.provinceCode,
      slug: plannerDestinations.slug,
      cityCode: plannerDestinations.cityCode,
      nameZh: plannerDestinations.nameZh,
      nameEn: plannerDestinations.nameEn,
      descriptionZh: plannerDestinations.descriptionZh,
      descriptionEn: plannerDestinations.descriptionEn,
      imageUrl: plannerDestinations.imageUrl,
      cardSize: plannerDestinations.cardSize,
      regionZh: plannerDestinations.regionZh,
      regionEn: plannerDestinations.regionEn,
      overnightZh: plannerDestinations.overnightZh,
      overnightEn: plannerDestinations.overnightEn,
      routeOrder: plannerDestinations.routeOrder,
      recommendedVisitHours: plannerDestinations.recommendedVisitHours,
      majorAttraction: plannerDestinations.majorAttraction,
      availableForPlanning: plannerDestinations.availableForPlanning,
      showOnHomepage: plannerDestinations.showOnHomepage,
      displayOrder: plannerDestinations.displayOrder,
    }).from(plannerDestinations).where(and(eq(plannerDestinations.tenantId, tenant.id), eq(plannerDestinations.status, "published"))).orderBy(asc(plannerDestinations.displayOrder), asc(plannerDestinations.id)),
  ]);
  const provinceCodes = new Set([...cityRows.map((city) => city.provinceCode), ...destinationRows.map((destination) => destination.provinceCode)]);
  const provinceRows = provinceCodes.size === 0 ? [] : await db.select({
    id: plannerProvinces.id,
    code: plannerProvinces.code,
    nameZh: plannerProvinces.nameZh,
    nameEn: plannerProvinces.nameEn,
    displayOrder: plannerProvinces.displayOrder,
  }).from(plannerProvinces).where(eq(plannerProvinces.status, "published")).orderBy(asc(plannerProvinces.displayOrder), asc(plannerProvinces.id));

  return {
    tenantId: tenant.id,
    provinces: provinceRows.filter((province) => provinceCodes.has(province.code)).map((province) => ({
      id: province.id,
      code: province.code,
      name: { zh: province.nameZh, en: province.nameEn },
      displayOrder: province.displayOrder,
    })),
    cities: cityRows.map((city) => ({
      id: city.id,
      provinceCode: city.provinceCode,
      code: city.code,
      name: { zh: city.nameZh, en: city.nameEn },
      availableAsStart: Boolean(city.availableAsStart),
      availableAsEnd: Boolean(city.availableAsEnd),
      displayOrder: city.displayOrder,
    })),
    destinations: destinationRows.map((destination) => ({
      id: destination.id,
      provinceCode: destination.provinceCode,
      slug: destination.slug,
      ...(destination.cityCode ? { cityCode: destination.cityCode } : {}),
      name: { zh: destination.nameZh, en: destination.nameEn },
      description: { zh: destination.descriptionZh, en: destination.descriptionEn },
      imageUrl: destination.imageUrl,
      cardSize: destination.cardSize === "large" ? "large" : "small",
      region: { zh: destination.regionZh, en: destination.regionEn },
      ...(destination.overnightZh || destination.overnightEn ? { overnightSuggestion: { zh: destination.overnightZh, en: destination.overnightEn } } : {}),
      routeOrder: destination.routeOrder,
      ...(destination.recommendedVisitHours === null ? {} : { recommendedVisitHours: destination.recommendedVisitHours }),
      majorAttraction: Boolean(destination.majorAttraction),
      availableForPlanning: Boolean(destination.availableForPlanning),
      showOnHomepage: Boolean(destination.showOnHomepage),
      displayOrder: destination.displayOrder,
    })),
  };
}
