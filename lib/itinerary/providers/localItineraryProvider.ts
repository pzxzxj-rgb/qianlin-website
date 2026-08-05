import { ItineraryGenerationError } from "../errors";
import type { ItineraryDay, ItineraryProvider, ItineraryRequest, ItineraryStop } from "../types";
import type { PlannerDestinationOption } from "../../planner/types";

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function planId(input: ItineraryRequest) {
  const normalized = [input.tenantId, [...new Set(input.destinationIds)].sort().join(","), input.days, input.travelers, input.startCity, input.endCity, input.language].join("|");
  return `local-${stableHash(normalized)}`;
}

function makeStop(destination: PlannerDestinationOption): ItineraryStop {
  return {
    destinationId: destination.id,
    name: destination.name,
  };
}

export const localItineraryProvider: ItineraryProvider = {
  async generate(input, context) {
    if (!input.tenantId || !Number.isInteger(input.days) || input.days < 1 || input.days > 14 || !input.startCity || !input.endCity) {
      throw new ItineraryGenerationError("INVALID_INPUT", input.language === "zh" ? "请检查出发城市、结束城市和出行天数。" : "Please check the cities and number of travel days.");
    }

    const startCity = context.cities.find((city) => city.code === input.startCity && city.availableAsStart);
    const endCity = context.cities.find((city) => city.code === input.endCity && city.availableAsEnd);
    if (!startCity || !endCity) {
      throw new ItineraryGenerationError("INVALID_INPUT", input.language === "zh" ? "请选择有效的出发城市和结束城市。" : "Please choose valid start and end cities.");
    }

    const destinationById = new Map(context.destinations.map((destination) => [destination.id, destination]));
    const requestedIds = [...new Set(input.destinationIds)];
    const unknownIds = requestedIds.filter((id) => !destinationById.has(id));
    const selected = requestedIds
      .map((id) => destinationById.get(id))
      .filter((destination): destination is PlannerDestinationOption => Boolean(destination && destination.availableForPlanning))
      .sort((left, right) => left.routeOrder - right.routeOrder || left.displayOrder - right.displayOrder);

    if (selected.length === 0) {
      throw new ItineraryGenerationError("NO_VALID_DESTINATIONS", input.language === "zh" ? "请至少选择一个可规划的目的地。" : "Please select at least one available destination.");
    }

    const unavailableIds = requestedIds.filter((id) => {
      const destination = destinationById.get(id);
      return Boolean(destination && !destination.availableForPlanning);
    });
    const dailyStopLimit = input.travelers === "6+" ? 1 : selected.length > input.days ? 2 : 1;
    const itineraryDays: ItineraryDay[] = [];
    let cursor = 0;

    for (let day = 1; day <= input.days; day += 1) {
      const remaining = selected.length - cursor;
      const daysRemaining = input.days - day + 1;
      const stopCount = remaining > 0 ? Math.min(dailyStopLimit, Math.ceil(remaining / daysRemaining)) : 0;
      const dayDestinations = selected.slice(cursor, cursor + stopCount);
      cursor += dayDestinations.length;
      const regions = [...new Set(dayDestinations.map((destination) => destination.region[input.language]))];
      const region = regions.length === 1 ? regions[0] : input.language === "zh" ? "区域衔接" : "Route connection";
      const stops = dayDestinations.map(makeStop);
      const overnight = dayDestinations.at(-1)?.overnightSuggestion;

      itineraryDays.push({
        day,
        title: dayDestinations.length > 0
          ? { zh: `第${day}天：${region}探索`, en: `Day ${day}: ${region} exploration` }
          : { zh: `第${day}天：自由安排`, en: `Day ${day}: Flexible time` },
        region,
        stops,
        ...(overnight ? { overnightSuggestion: overnight } : {}),
        note: dayDestinations.length > 1
          ? { zh: "当天包含多个景点，建议由旅行顾问进一步确认车程和开放时间。", en: "This day includes more than one stop; a travel consultant should confirm driving time and opening hours." }
          : dayDestinations.length === 1
            ? { zh: "具体车程、开放时间和交通安排需进一步确认。", en: "Driving time, opening hours and transport details need to be confirmed." }
            : { zh: "保留弹性时间，实际安排需结合交通和开放时间确认。", en: "Keep this time flexible and confirm it against transport and opening hours." },
      });
    }

    const unassignedDestinationIds = [...unknownIds, ...unavailableIds, ...selected.slice(cursor).map((destination) => destination.id)];
    const warnings = [
      input.language === "zh"
        ? "该行程根据景点区域和建议游玩时长自动整理，仅供前期参考。实际车程、开放时间、住宿和交通安排需要由旅行顾问进一步确认。"
        : "This reference itinerary is organized by destination areas and suggested visit time. Actual driving time, opening hours, accommodation and transport must be confirmed with a travel consultant.",
    ];

    if (unassignedDestinationIds.length > 0) {
      const unassignedNames = unassignedDestinationIds.map((id) => {
        const destination = destinationById.get(id);
        return destination ? destination.name[input.language] : id;
      }).join(input.language === "zh" ? "、" : ", ");
      warnings.push(input.language === "zh" ? `当前天数、人数或景点状态导致以下景点暂未排入行程：${unassignedNames}` : `These stops were not included because of available time, group size or destination status: ${unassignedNames}.`);
    }

    if (input.travelers === "6+") {
      warnings.push(input.language === "zh" ? "人数较多时建议减少每天景点数量，并由旅行顾问确认车辆和集合安排。" : "For larger groups, fewer daily stops are recommended; vehicle and meeting arrangements should be confirmed with a travel consultant.");
    }

    return {
      id: planId(input),
      input,
      days: itineraryDays,
      warnings,
      unassignedDestinationIds,
      generatedBy: "local",
    };
  },
};
