"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "./LanguageContext";
import type { PlannerCityOption, PlannerDestinationOption, PlannerOptionsLoadState, PlannerOptionsResponse, PlannerProvinceOption } from "../lib/planner/types";
import { isAdminImagePathForUsage } from "../lib/admin/imageCatalog";

type PlannerOptionsContextValue = {
  status: PlannerOptionsLoadState;
  provinces: PlannerProvinceOption[];
  cities: PlannerCityOption[];
  destinations: PlannerDestinationOption[];
  error: string;
  retry: () => void;
};

type PlannerOptionsState = Omit<PlannerOptionsContextValue, "error" | "retry"> & { errorZh: string; errorEn: string };

const PlannerOptionsContext = createContext<PlannerOptionsContextValue | null>(null);
const initialState: PlannerOptionsState = { status: "idle", provinces: [], cities: [], destinations: [], errorZh: "", errorEn: "" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isLocalizedText(value: unknown): value is { zh: string; en: string } {
  return isRecord(value) && typeof value.zh === "string" && typeof value.en === "string";
}

function isPlannerDestination(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return typeof value.id === "string"
    && typeof value.provinceCode === "string"
    && typeof value.slug === "string"
    && (value.cityCode === undefined || typeof value.cityCode === "string")
    && isLocalizedText(value.name)
    && isLocalizedText(value.description)
    && typeof value.imageUrl === "string"
    && (value.imageUrl === "" || isAdminImagePathForUsage(value.imageUrl, "destination"))
    && (value.cardSize === "small" || value.cardSize === "large")
    && isLocalizedText(value.region)
    && (value.overnightSuggestion === undefined || isLocalizedText(value.overnightSuggestion))
    && Number.isInteger(value.routeOrder) && value.routeOrder >= 0 && value.routeOrder <= 1000
    && (value.recommendedVisitHours === undefined || (Number.isInteger(value.recommendedVisitHours) && value.recommendedVisitHours >= 1 && value.recommendedVisitHours <= 48))
    && typeof value.majorAttraction === "boolean"
    && typeof value.availableForPlanning === "boolean"
    && typeof value.showOnHomepage === "boolean"
    && Number.isInteger(value.displayOrder) && value.displayOrder >= 0 && value.displayOrder <= 1000;
}

function isPlannerOptionsResponse(value: unknown, tenantSlug: string): value is PlannerOptionsResponse {
  if (!isRecord(value) || value.tenantSlug !== tenantSlug || typeof value.tenantId !== "string") return false;
  if (!Array.isArray(value.provinces) || !Array.isArray(value.cities) || !Array.isArray(value.destinations)) return false;
  return value.provinces.every((province) => isRecord(province) && typeof province.id === "string" && typeof province.code === "string" && isLocalizedText(province.name) && Number.isInteger(province.displayOrder))
    && value.cities.every((city) => isRecord(city) && typeof city.id === "string" && typeof city.provinceCode === "string" && typeof city.code === "string" && isLocalizedText(city.name) && typeof city.availableAsStart === "boolean" && typeof city.availableAsEnd === "boolean" && Number.isInteger(city.displayOrder))
    && value.destinations.every(isPlannerDestination);
}

export function PlannerOptionsProvider({ children, tenantSlug }: { children: React.ReactNode; tenantSlug: string }) {
  const { language } = useLanguage();
  const [state, setState] = useState<PlannerOptionsState>(initialState);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const loadOptions = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ status: "loading", provinces: [], cities: [], destinations: [], errorZh: "", errorEn: "" });

    try {
      const response = await fetch(`/api/t/${encodeURIComponent(tenantSlug)}/planner/options`, { headers: { Accept: "application/json" }, signal: controller.signal });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok || !isPlannerOptionsResponse(payload, tenantSlug)) throw new Error("PLANNER_OPTIONS_UNAVAILABLE");
      if (requestId !== requestIdRef.current || controller.signal.aborted) return;
      setState({ status: "success", provinces: payload.provinces, cities: payload.cities, destinations: payload.destinations, errorZh: "", errorEn: "" });
    } catch {
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      setState({ status: "error", provinces: [], cities: [], destinations: [], errorZh: "规划选项暂时无法加载，请稍后重试。", errorEn: "Planning options are temporarily unavailable. Please try again later." });
    }
  }, [tenantSlug]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadOptions(); }, 0);
    return () => {
      window.clearTimeout(timer);
      requestIdRef.current += 1;
      abortRef.current?.abort();
    };
  }, [loadOptions]);

  const value = useMemo<PlannerOptionsContextValue>(() => ({
    status: state.status,
    provinces: state.provinces,
    cities: state.cities,
    destinations: state.destinations,
    error: language === "zh" ? state.errorZh : state.errorEn,
    retry: loadOptions,
  }), [language, loadOptions, state]);

  return <PlannerOptionsContext.Provider value={value}>{children}</PlannerOptionsContext.Provider>;
}

export function usePlannerOptions() {
  const context = useContext(PlannerOptionsContext);
  if (!context) throw new Error("usePlannerOptions must be used inside PlannerOptionsProvider");
  return context;
}
