"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { TenantSiteConfig } from "../lib/tenancy/types";

type TenantSiteState = {
  status: "loading" | "success" | "error";
  config: TenantSiteConfig | null;
  retry: () => void;
};

const TenantSiteContext = createContext<TenantSiteState | null>(null);

export function TenantSiteProvider({ tenantSlug, initialConfig, children }: { tenantSlug: string; initialConfig: TenantSiteConfig | null; children: React.ReactNode }) {
  const [state, setState] = useState<{ status: TenantSiteState["status"]; config: TenantSiteConfig | null }>({ status: initialConfig ? "success" : "loading", config: initialConfig });

  const loadConfig = useCallback(async () => {
    setState((current) => ({ ...current, status: current.config ? "success" : "loading" }));
    try {
      const response = await fetch(`/api/t/${encodeURIComponent(tenantSlug)}/site-config`, { headers: { Accept: "application/json" } });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok || !payload || typeof payload !== "object" || !("tenant" in payload) || !("profile" in payload)) throw new Error("SITE_CONFIG_UNAVAILABLE");
      setState({ status: "success", config: payload as TenantSiteConfig });
    } catch {
      setState((current) => ({ status: current.config ? "success" : "error", config: current.config }));
    }
  }, [tenantSlug]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => { void loadConfig(); }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [loadConfig]);

  const value = useMemo(() => ({ ...state, retry: loadConfig }), [loadConfig, state]);
  return <TenantSiteContext.Provider value={value}>{children}</TenantSiteContext.Provider>;
}

export function useTenantSite() {
  const context = useContext(TenantSiteContext);
  if (!context) throw new Error("useTenantSite must be used inside TenantSiteProvider");
  return context;
}
