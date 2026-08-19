"use client";

import Link from "next/link";
import { useState } from "react";
import type { CSSProperties } from "react";
import { AdminLogoutButton } from "./AdminDashboard";
import { adminApiPath, adminPagePath } from "./adminPaths";
import type { AdminThemeState } from "../lib/admin/theme";
import { themeCssVariables, themeDraftToConfig, themeClassNames, type ThemeDraftValues } from "../lib/theme/themeConfig";

type PreviewMode = "desktop" | "mobile";

function PreviewCanvas({ values, mode }: { values: ThemeDraftValues; mode: PreviewMode }) {
  const config = themeDraftToConfig(values);
  const cssVariables = themeCssVariables(config) as CSSProperties;
  return <div className={`admin-theme-preview-frame admin-theme-preview-${mode}`}>
    <div className={`admin-theme-preview-site tenant-theme-shell ${themeClassNames(config)}`} style={cssVariables}>
      <div className="admin-theme-preview-nav"><strong>QIANLIN</strong><span>Explore</span><span>Plan a journey</span><button type="button" className="button button-dark button-small">Contact</button></div>
      <div className="admin-theme-preview-hero"><span className="eyebrow">CONTROLLED PREVIEW</span><h3>Journeys with a point of view</h3><p>Preview is based on the draft. It is not public until an administrator publishes it.</p><button type="button" className="button button-light">Start planning</button></div>
      <div className="admin-theme-preview-section"><div><span className="eyebrow">CURATED ROUTES</span><h4>Made for your next escape</h4></div><div className="admin-theme-preview-cards"><article><span className="admin-theme-preview-image" /><strong>Mountain light</strong><small>4 days · Guizhou</small></article><article><span className="admin-theme-preview-image admin-theme-preview-image-alt" /><strong>Tea and cloud</strong><small>6 days · Yunnan</small></article></div></div>
    </div>
  </div>;
}

function SelectField({ label, value, options, disabled, onChange }: { label: string; value: string; options: readonly string[]; disabled: boolean; onChange: (value: string) => void }) {
  return <label className="admin-theme-field"><span>{label}</span><select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

export function AdminThemeStudio({ initialState, tenantSlug, canEdit, canPublish }: { initialState: AdminThemeState; tenantSlug: string; canEdit: boolean; canPublish: boolean }) {
  const [state, setState] = useState(initialState);
  const [draft, setDraft] = useState(initialState.draft.values);
  const [mode, setMode] = useState<PreviewMode>("desktop");
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const apiBase = adminApiPath(tenantSlug, "/theme");

  function updateDraft(field: keyof ThemeDraftValues, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setMessage("");
    setError("");
  }

  async function request(path: string, method: "PUT" | "POST", body: unknown) {
    setPending(path);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`${apiBase}${path}`, { method, headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body), cache: "no-store" });
      const payload = await response.json().catch(() => null) as { errorEn?: string } | null;
      if (!response.ok) throw new Error(payload?.errorEn || "Theme request failed.");
      return payload as AdminThemeState;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Theme request failed.");
      return null;
    } finally {
      setPending("");
    }
  }

  async function saveDraft() {
    if (!canEdit || pending) return;
    const nextState = await request("/draft", "PUT", draft);
    if (!nextState) return;
    setState(nextState);
    setDraft(nextState.draft.values);
    setMessage("Draft saved.");
  }

  async function resetDraft() {
    if (!canEdit || pending || !window.confirm("Reset the draft to the published theme?")) return;
    const nextDraft = await request("/draft/reset", "POST", {});
    if (!nextDraft) return;
    setState((current) => ({ ...current, draft: nextDraft as unknown as AdminThemeState["draft"] }));
    setDraft((nextDraft as unknown as AdminThemeState["draft"]).values);
    setMessage("Draft reset to the published theme.");
  }

  async function publish() {
    if (!canPublish || pending || !window.confirm("Publish this draft to the public site?")) return;
    const nextState = await request("/publish", "POST", {});
    if (!nextState) return;
    setState(nextState);
    setDraft(nextState.draft.values);
    setMessage("Theme published.");
  }

  const disabled = Boolean(pending) || !canEdit;
  return <main className="admin-page">
    <header className="admin-topbar"><Link className="admin-brand" href={adminPagePath(tenantSlug, "")}><span className="brand-mark">Q</span><span><strong>QIANLIN TRAVEL</strong><small>Theme Studio</small></span></Link><div className="admin-topbar-actions"><Link className="admin-profile-back-link" href={adminPagePath(tenantSlug, "")}>Back to dashboard</Link><AdminLogoutButton /></div></header>
    <div className="admin-shell admin-theme-shell">
      <div className="admin-heading"><div><span className="eyebrow">QIANLIN TRAVEL / CONTROLLED THEME STUDIO</span><h1>Theme Studio</h1><p>Choose from controlled presets and tokens. Draft edits stay private until an administrator publishes them.</p></div></div>
      <div className="admin-theme-layout">
        <section className="admin-card admin-theme-controls" aria-label="Theme controls">
          <div className="admin-card-heading"><div><span className="eyebrow">DRAFT CONTROLS</span><h2>Build the draft</h2></div><span className="admin-theme-status">Draft v{state.draft.version}</span></div>
          <SelectField label="Template preset" value={draft.templateKey} options={state.availablePresets.map((preset) => preset.key)} disabled={disabled} onChange={(value) => updateDraft("templateKey", value)} />
          <div className="admin-theme-color-grid">{([['primaryColor', 'Primary'], ['secondaryColor', 'Secondary'], ['accentColor', 'Accent'], ['backgroundColor', 'Background']] as const).map(([field, label]) => <label className="admin-theme-color-field" key={field}><span>{label}</span><input type="color" value={draft[field]} disabled={disabled} onChange={(event) => updateDraft(field, event.target.value)} /><code>{draft[field]}</code></label>)}</div>
          <SelectField label="Font preset" value={draft.fontPreset} options={["modern", "elegant", "editorial", "friendly"]} disabled={disabled} onChange={(value) => updateDraft("fontPreset", value)} />
          <div className="admin-theme-select-grid"><SelectField label="Button style" value={draft.buttonStyle} options={["rounded", "square", "pill"]} disabled={disabled} onChange={(value) => updateDraft("buttonStyle", value)} /><SelectField label="Card style" value={draft.cardStyle} options={["flat", "bordered", "elevated"]} disabled={disabled} onChange={(value) => updateDraft("cardStyle", value)} /><SelectField label="Section style" value={draft.sectionStyle} options={["clean", "soft", "contrast"]} disabled={disabled} onChange={(value) => updateDraft("sectionStyle", value)} /></div>
          <div className="admin-theme-actions"><button type="button" className="button button-dark" disabled={disabled} onClick={() => void saveDraft()}>{pending === "/draft" ? "Saving…" : "Save draft"}</button><button type="button" className="button button-light" disabled={disabled} onClick={() => void resetDraft()}>Reset draft</button>{canPublish ? <button type="button" className="button button-light" disabled={Boolean(pending)} onClick={() => void publish()}>{pending === "/publish" ? "Publishing…" : "Publish"}</button> : null}</div>
          {!canEdit ? <p className="admin-theme-note">You have read-only access to this theme.</p> : null}
          {message ? <p className="admin-save-success" role="status">{message}</p> : null}
          {error ? <p className="admin-form-error" role="alert">{error}</p> : null}
        </section>
        <section className="admin-card admin-theme-preview-card"><div className="admin-card-heading"><div><span className="eyebrow">LIVE DRAFT PREVIEW</span><h2>Preview</h2></div><div className="admin-theme-preview-switcher"><button type="button" className={mode === "desktop" ? "active" : ""} onClick={() => setMode("desktop")}>Desktop</button><button type="button" className={mode === "mobile" ? "active" : ""} onClick={() => setMode("mobile")}>Mobile</button></div></div><p className="admin-theme-note">Only the current draft is rendered here. The public site continues to use the published theme.</p><PreviewCanvas values={draft} mode={mode} /></section>
      </div>
    </div>
  </main>;
}
