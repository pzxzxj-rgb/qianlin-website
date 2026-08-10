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

function isIntegerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum;
}

function isPlannerDestination(value: unknown): value is PlannerDestinationOption {
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
    && isIntegerInRange(value.routeOrder, 0, 1000)
    && (value.recommendedVisitHours === undefined || isIntegerInRange(value.recommendedVisitHours, 1, 48))
    && typeof value.majorAttraction === "boolean"
    && typeof value.availableForPlanning === "boolean"
    && typeof value.showOnHomepage === "boolean"
    && isIntegerInRange(value.displayOrder, 0, 1000);
}

function isPlannerProvince(value: unknown): value is PlannerProvinceOption {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.code === "string"
    && isLocalizedText(value.name)
    && Number.isInteger(value.displayOrder);
}

function isPlannerCity(value: unknown): value is PlannerCityOption {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.provinceCode === "string"
    && typeof value.code === "string"
    && isLocalizedText(value.name)
    && typeof value.availableAsStart === "boolean"
    && typeof value.availableAsEnd === "boolean"
    && Number.isInteger(value.displayOrder);
}

function isPlannerOptionsResponse(value: unknown, tenantSlug: string): value is PlannerOptionsResponse {
  if (!isRecord(value) || value.tenantSlug !== tenantSlug || typeof value.tenantId !== "string") return false;
  if (!Array.isArray(value.provinces) || !Array.isArray(value.cities) || !Array.isArray(value.destinations)) return false;
  return value.provinces.every(isPlannerProvince)
    && value.cities.every(isPlannerCity)
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
