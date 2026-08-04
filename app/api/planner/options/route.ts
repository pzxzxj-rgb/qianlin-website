import { asc, and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { plannerCities, plannerDestinations } from "../../../../db/schema";
import { PLANNER_TENANT_ID } from "../../../../lib/planner/config";
import type { PlannerOptionsResponse } from "../../../../lib/planner/types";

function errorResponse() {
  return Response.json({ errorZh: "规划选项暂时无法加载，请稍后重试。", errorEn: "Planning options are temporarily unavailable. Please try again later." }, { status: 503, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  try {
    const db = await getDb();
    const [cityRows, destinationRows] = await Promise.all([
      db.select({
        id: plannerCities.id,
        code: plannerCities.code,
        nameZh: plannerCities.nameZh,
        nameEn: plannerCities.nameEn,
        availableAsStart: plannerCities.availableAsStart,
        availableAsEnd: plannerCities.availableAsEnd,
        displayOrder: plannerCities.displayOrder,
      }).from(plannerCities).where(and(eq(plannerCities.tenantId, PLANNER_TENANT_ID), eq(plannerCities.status, "published"))).orderBy(asc(plannerCities.displayOrder), asc(plannerCities.id)),
      db.select({
        id: plannerDestinations.id,
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
      }).from(plannerDestinations).where(and(eq(plannerDestinations.tenantId, PLANNER_TENANT_ID), eq(plannerDestinations.status, "published"))).orderBy(asc(plannerDestinations.displayOrder), asc(plannerDestinations.id)),
    ]);

    const response: PlannerOptionsResponse = {
      tenantId: PLANNER_TENANT_ID,
      cities: cityRows.map((city) => ({
        id: city.id,
        code: city.code,
        name: { zh: city.nameZh, en: city.nameEn },
        availableAsStart: Boolean(city.availableAsStart),
        availableAsEnd: Boolean(city.availableAsEnd),
        displayOrder: city.displayOrder,
      })),
      destinations: destinationRows.map((destination) => ({
        id: destination.id,
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

    return Response.json(response, { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } });
  } catch (error) {
    console.error("Failed to load planner options", error instanceof Error ? error.name : "UnknownError");
    return errorResponse();
  }
}
