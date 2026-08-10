"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { TenantSiteConfig } from "../lib/tenancy/types";

type TenantSiteState = {
  status: "loading" | "success" | "error";
  config: TenantSiteConfig | null;
  isRefreshing: boolean;
  retry: () => void;
};

const TenantSiteContext = createContext<TenantSiteState | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isPublicTour(value: unknown, tenantId: string) {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && value.tenantId === tenantId && typeof value.slug === "string" && isRecord(value.title) && typeof value.title.zh === "string" && typeof value.title.en === "string" && isRecord(value.description) && typeof value.description.zh === "string" && typeof value.description.en === "string" && typeof value.featured === "boolean" && Number.isInteger(value.displayOrder) && value.status === "published";
}

function isTenantSiteConfig(value: unknown, tenantSlug: string): value is TenantSiteConfig {
  if (!isRecord(value) || !isRecord(value.tenant) || !isRecord(value.profile)) return false;
  const tenant = value.tenant;
  const tenantId = tenant.id;
  if (typeof tenant.slug !== "string" || typeof tenantId !== "string" || tenant.slug !== tenantSlug) return false;
  if (tenant.siteStatus !== "configuring" && tenant.siteStatus !== "published") return false;
  if (typeof value.isConfigured !== "boolean" || !Array.isArray(value.contacts) || !Array.isArray(value.tours) || !value.tours.every((tour) => isPublicTour(tour, tenantId)) || !Array.isArray(value.heroSlides)) return false;
  return true;
}

export function TenantSiteProvider({ tenantSlug, initialConfig, children }: { tenantSlug: string; initialConfig: TenantSiteConfig | null; children: React.ReactNode }) {
  const usableInitialConfig = initialConfig?.tenant.slug === tenantSlug ? initialConfig : null;
  const hasInitialConfig = Boolean(usableInitialConfig);
  const [state, setState] = useState<{ status: TenantSiteState["status"]; config: TenantSiteConfig | null; isRefreshing: boolean }>({ status: usableInitialConfig ? "success" : "loading", config: usableInitialConfig, isRefreshing: false });
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const lastRefreshAtRef = useRef(0);

  const loadConfig = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    lastRefreshAtRef.current = Date.now();
    setState((current) => ({ status: current.config ? "success" : "loading", config: current.config, isRefreshing: Boolean(current.config) }));

    try {
      const response = await fetch(`/api/t/${encodeURIComponent(tenantSlug)}/site-config`, { cache: "no-store", headers: { Accept: "application/json" }, signal: controller.signal });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok || !isTenantSiteConfig(payload, tenantSlug)) throw new Error("SITE_CONFIG_UNAVAILABLE");
      if (requestId !== requestIdRef.current || controller.signal.aborted) return;
      setState({ status: "success", config: payload, isRefreshing: false });
    } catch {
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      setState((current) => ({ status: current.config ? "success" : "error", config: current.config, isRefreshing: false }));
    }
  }, [tenantSlug]);

  const refreshOnFocus = useCallback(() => {
    if (document.visibilityState !== "visible" || Date.now() - lastRefreshAtRef.current < 30_000) return;
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    let initialLoadTimer: number | undefined;
    if (!hasInitialConfig) {
      initialLoadTimer = window.setTimeout(() => { void loadConfig(); }, 0);
    } else {
      lastRefreshAtRef.current = Date.now();
      window.addEventListener("focus", refreshOnFocus);
      document.addEventListener("visibilitychange", refreshOnFocus);
    }
    return () => {
      if (initialLoadTimer !== undefined) window.clearTimeout(initialLoadTimer);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
      requestIdRef.current += 1;
      abortRef.current?.abort();
    };
  }, [hasInitialConfig, loadConfig, refreshOnFocus]);

  const value = useMemo(() => ({ ...state, retry: loadConfig }), [loadConfig, state]);
  return <TenantSiteContext.Provider value={value}>{children}</TenantSiteContext.Provider>;
}

export function useTenantSite() {
  const context = useContext(TenantSiteContext);
  if (!context) throw new Error("useTenantSite must be used inside TenantSiteProvider");
  return context;
}
