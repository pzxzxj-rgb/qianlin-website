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
  if (value.tenant.slug !== tenantSlug || typeof value.tenant.id !== "string") return false;
  if (value.tenant.siteStatus !== "configuring" && value.tenant.siteStatus !== "published") return false;
  if (typeof value.isConfigured !== "boolean" || !Array.isArray(value.contacts) || !Array.isArray(value.tours) || !value.tours.every((tour) => isPublicTour(tour, value.tenant.id)) || !Array.isArray(value.heroSlides)) return false;
  return true;
}

export function TenantSiteProvider({ tenantSlug, initialConfig, children }: { tenantSlug: string; initialConfig: TenantSiteConfig | null; children: React.ReactNode }) {
  const usableInitialConfig = initialConfig?.tenant.slug === tenantSlug ? initialConfig : null;
  const [state, setState] = useState<{ status: TenantSiteState["status"]; config: TenantSiteConfig | null; isRefreshing: boolean }>({ status: usableInitialConfig ? "success" : "loading", config: usableInitialConfig, isRefreshing: false });
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const loadConfig = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState((current) => ({ status: current.config ? "success" : "loading", config: current.config, isRefreshing: Boolean(current.config) }));

    try {
      const response = await fetch(`/api/t/${encodeURIComponent(tenantSlug)}/site-config`, { headers: { Accept: "application/json" }, signal: controller.signal });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok || !isTenantSiteConfig(payload, tenantSlug)) throw new Error("SITE_CONFIG_UNAVAILABLE");
      if (requestId !== requestIdRef.current || controller.signal.aborted) return;
      setState({ status: "success", config: payload, isRefreshing: false });
    } catch {
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      setState((current) => ({ status: current.config ? "success" : "error", config: current.config, isRefreshing: false }));
    }
  }, [tenantSlug]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadConfig(); }, 0);
    return () => {
      window.clearTimeout(timer);
      requestIdRef.current += 1;
      abortRef.current?.abort();
    };
  }, [loadConfig]);

  const value = useMemo(() => ({ ...state, retry: loadConfig }), [loadConfig, state]);
  return <TenantSiteContext.Provider value={value}>{children}</TenantSiteContext.Provider>;
}

export function useTenantSite() {
  const context = useContext(TenantSiteContext);
  if (!context) throw new Error("useTenantSite must be used inside TenantSiteProvider");
  return context;
}
