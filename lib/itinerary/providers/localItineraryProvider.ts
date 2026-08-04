import { destinations } from "../../../data/destinations";
import { ItineraryGenerationError } from "../errors";
import type { ItineraryDay, ItineraryProvider, ItineraryRequest, ItineraryStop } from "../types";

const destinationById = new Map(destinations.map((destination) => [destination.id, destination]));

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

function makeStop(destination: (typeof destinations)[number]): ItineraryStop {
  return {
    destinationId: destination.id,
    name: { zh: destination.nameZh, en: destination.name },
  };
}

export const localItineraryProvider: ItineraryProvider = {
  async generate(input) {
    if (!input.tenantId || !Number.isInteger(input.days) || input.days < 1 || input.days > 14 || !input.startCity || !input.endCity) {
      throw new ItineraryGenerationError("INVALID_INPUT", input.language === "zh" ? "请检查出发城市、结束城市和出行天数。" : "Please check the cities and number of travel days.");
    }

    const requestedIds = [...new Set(input.destinationIds)];
    const unknownIds = requestedIds.filter((id) => !destinationById.has(id));
    const selected = requestedIds
      .map((id) => destinationById.get(id))
      .filter((destination): destination is (typeof destinations)[number] => Boolean(destination))
      .sort((left, right) => left.itinerary.routeOrder - right.itinerary.routeOrder);

    if (selected.length === 0) {
      throw new ItineraryGenerationError("NO_VALID_DESTINATIONS", input.language === "zh" ? "请至少选择一个贵州景点。" : "Please select at least one Guizhou destination.");
    }

    const dailyStopLimit = input.travelers === "6+" ? 1 : selected.length > input.days ? 2 : 1;
    const itineraryDays: ItineraryDay[] = [];
    let cursor = 0;

    for (let day = 1; day <= input.days; day += 1) {
      const remaining = selected.length - cursor;
      const daysRemaining = input.days - day + 1;
      const stopCount = remaining > 0 ? Math.min(dailyStopLimit, Math.ceil(remaining / daysRemaining)) : 0;
      const dayDestinations = selected.slice(cursor, cursor + stopCount);
      cursor += dayDestinations.length;
      const regions = [...new Set(dayDestinations.map((destination) => destination.itinerary.region[input.language]))];
      const region = regions.length === 1 ? regions[0] : input.language === "zh" ? "区域衔接" : "Route connection";
      const stops = dayDestinations.map(makeStop);

      itineraryDays.push({
        day,
        title: dayDestinations.length > 0
          ? { zh: `第${day}天：${region}探索`, en: `Day ${day}: ${region} exploration` }
          : { zh: `第${day}天：自由安排`, en: `Day ${day}: Flexible time` },
        region,
        stops,
        overnightSuggestion: dayDestinations.at(-1)?.itinerary.overnight,
        note: dayDestinations.length > 1
          ? { zh: "当天包含多个景点，建议由旅行顾问进一步确认车程和开放时间。", en: "This day includes more than one stop; a travel consultant should confirm driving time and opening hours." }
          : dayDestinations.length === 1
            ? { zh: "具体车程、开放时间和交通安排需进一步确认。", en: "Driving time, opening hours and transport details need to be confirmed." }
            : { zh: "保留弹性时间，实际安排需结合交通和开放时间确认。", en: "Keep this time flexible and confirm it against transport and opening hours." },
      });
    }

    const unassignedDestinationIds = [...unknownIds, ...selected.slice(cursor).map((destination) => destination.id)];
    const warnings = [
      input.language === "zh"
        ? "该行程根据景点区域和建议游玩时长自动整理，仅供前期参考。实际车程、开放时间、住宿和交通安排需要由旅行顾问进一步确认。"
        : "This reference itinerary is organized by destination areas and suggested visit time. Actual driving time, opening hours, accommodation and transport must be confirmed with a travel consultant.",
    ];

    if (unassignedDestinationIds.length > 0) {
      const unassignedNames = unassignedDestinationIds.map((id) => {
        const destination = destinationById.get(id);
        return destination ? (input.language === "zh" ? destination.nameZh : destination.name) : id;
      }).join(input.language === "zh" ? "、" : ", ");
      warnings.push(input.language === "zh" ? `当前天数或人数安排不足，以下景点暂未排入行程：${unassignedNames}` : `The available days or group size could not fit these stops: ${unassignedNames}.`);
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
