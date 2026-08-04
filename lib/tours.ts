import type { Tour } from "../types/tour";

export const HOME_TOUR_LIMIT = 6;

export function getVisibleTours(tours: readonly Tour[], tenantId: string, limit = HOME_TOUR_LIMIT): Tour[] {
  return tours
    .filter((tour) => tour.tenantId === tenantId && tour.status === "published" && tour.featured)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .slice(0, limit);
}
