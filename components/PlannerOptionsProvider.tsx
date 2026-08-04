"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLanguage } from "./LanguageContext";
import type { PlannerCityOption, PlannerDestinationOption, PlannerOptionsLoadState, PlannerOptionsResponse } from "../lib/planner/types";

type PlannerOptionsContextValue = {
  status: PlannerOptionsLoadState;
  cities: PlannerCityOption[];
  destinations: PlannerDestinationOption[];
  error: string;
  retry: () => void;
};

type PlannerOptionsState = Omit<PlannerOptionsContextValue, "error" | "retry"> & { errorZh: string; errorEn: string };

const PlannerOptionsContext = createContext<PlannerOptionsContextValue | null>(null);

const initialState: PlannerOptionsState = { status: "idle", cities: [], destinations: [], errorZh: "", errorEn: "" };

function isPlannerOptionsResponse(value: unknown): value is PlannerOptionsResponse {
  if (!value || typeof value !== "object") return false;
  const response = value as Partial<PlannerOptionsResponse>;
  return typeof response.tenantId === "string" && Array.isArray(response.cities) && Array.isArray(response.destinations);
}

export function PlannerOptionsProvider({ children }: { children: React.ReactNode }) {
  const { language } = useLanguage();
  const [state, setState] = useState<PlannerOptionsState>(initialState);

  const loadOptions = useCallback(async () => {
    setState((current) => ({ ...current, status: "loading", cities: [], destinations: [], errorZh: "", errorEn: "" }));
    try {
      const response = await fetch("/api/planner/options", { headers: { Accept: "application/json" } });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok || !isPlannerOptionsResponse(payload)) {
        const errorPayload = payload as { errorZh?: unknown; errorEn?: unknown } | null;
        throw new Error(typeof errorPayload?.errorZh === "string" ? errorPayload.errorZh : "Planning options are temporarily unavailable.");
      }
      setState({ status: "success", cities: payload.cities, destinations: payload.destinations, errorZh: "", errorEn: "" });
    } catch {
      setState({ status: "error", cities: [], destinations: [], errorZh: "规划选项暂时无法加载，请稍后重试。", errorEn: "Planning options are temporarily unavailable. Please try again later." });
    }
  }, []);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadOptions();
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [loadOptions]);

  const value = useMemo<PlannerOptionsContextValue>(() => ({
    status: state.status,
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
