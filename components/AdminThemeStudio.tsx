"use client";

import Link from "next/link";
import { useState } from "react";
import type { CSSProperties } from "react";
import { AdminLogoutButton } from "./AdminDashboard";
import { adminApiPath, adminPagePath } from "./adminPaths";
import type { AdminThemeState } from "../lib/admin/theme";
import { themeCssVariables, themeDraftToConfig, themeClassNames, type ThemeDraftValues } from "../lib/theme/themeConfig";

type PreviewMode = "desktop" | "mobile";

const TEMPLATE_LABELS: Record<string, string> = {
  modern: "现代",
  natural: "自然",
  elegant: "典雅",
  youthful: "年轻活力",
};

const FONT_LABELS: Record<string, string> = {
  modern: "现代",
  elegant: "典雅",
  editorial: "杂志",
  friendly: "亲和",
};

const BUTTON_LABELS: Record<string, string> = {
  rounded: "圆角",
  square: "直角",
  pill: "胶囊",
};

const CARD_LABELS: Record<string, string> = {
  flat: "扁平",
  bordered: "描边",
  elevated: "悬浮阴影",
};

const SECTION_LABELS: Record<string, string> = {
  clean: "简洁",
  soft: "柔和",
  contrast: "高对比",
};

function PreviewCanvas({
  values,
  mode,
}: {
  values: ThemeDraftValues;
  mode: PreviewMode;
}) {
  const config = themeDraftToConfig(values);
  const cssVariables = themeCssVariables(config) as CSSProperties;
  return (
    <div
      className={`admin-theme-preview-frame admin-theme-preview-${mode}`}
    >
      <div
        className={`admin-theme-preview-site tenant-theme-shell ${themeClassNames(config)}`}
        style={cssVariables}
      >
        <div className="admin-theme-preview-nav">
          <strong>黔林旅行</strong>
          <span>探索目的地</span>
          <span>定制旅行</span>

          <button
            type="button"
            className="button button-dark button-small"
          >
            联系我们
          </button>
        </div>

        <div className="admin-theme-preview-hero">
          <span className="eyebrow">实时主题预览</span>

          <h3>探索一段真正属于你的旅程</h3>

          <p>
            这里展示的是当前草稿效果。
            在点击发布之前，不会影响正式网站。
          </p>

          <button type="button" className="button button-light">
            开始定制
          </button>
        </div>

        <div className="admin-theme-preview-section">
          <div>
            <span className="eyebrow">精选线路</span>
            <h4>寻找你的下一段旅程</h4>
          </div>

          <div className="admin-theme-preview-cards">
            <article>
              <span className="admin-theme-preview-image" />
              <strong>贵州山水秘境</strong>
              <small>4 天 · 贵州</small>
            </article>

            <article>
              <span className="admin-theme-preview-image admin-theme-preview-image-alt" />
              <strong>云南茶马之旅</strong>
              <small>6 天 · 云南</small>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  optionLabels,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  optionLabels?: Record<string, string>;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="admin-theme-field">
      <span>{label}</span>

      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabels?.[option] ?? option}
          </option>
        ))}
      </select>
    </label>
  );
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
      const payload = await response.json().catch(() => null) as {
        errorZh?: string;
        errorEn?: string;
      } | null;
      if (!response.ok) {
        throw new Error(
          payload?.errorZh ||
            payload?.errorEn ||
            "主题操作失败，请稍后重试。"
        );
      }
      return payload as AdminThemeState;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "主题操作失败，请稍后重试。"
      );
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
    setMessage("草稿已保存。");
  }

  async function resetDraft() {
    if (
      !canEdit ||
      pending ||
      !window.confirm(
        "确定要放弃当前草稿，并恢复为目前官网正在使用的主题吗？"
      )
    ) return;
    const nextDraft = await request("/draft/reset", "POST", {});
    if (!nextDraft) return;
    setState((current) => ({ ...current, draft: nextDraft as unknown as AdminThemeState["draft"] }));
    setDraft((nextDraft as unknown as AdminThemeState["draft"]).values);
    setMessage("草稿已恢复为当前正式网站使用的主题。");
  }

  async function publish() {
    if (
      !canPublish ||
      pending ||
      !window.confirm(
        "确定要将当前主题发布到正式官网吗？发布后访客将看到新的网站样式。"
      )
    ) return;
    const nextState = await request("/publish", "POST", {});
    if (!nextState) return;
    setState(nextState);
    setDraft(nextState.draft.values);
    setMessage("主题已成功发布到官网。");
  }

  const disabled = Boolean(pending) || !canEdit;
  return <main className="admin-page">
    <header className="admin-topbar"><Link className="admin-brand" href={adminPagePath(tenantSlug, "")}><span className="brand-mark">Q</span><span><strong>QIANLIN TRAVEL</strong><small>可视化编辑器</small></span></Link><div className="admin-topbar-actions"><Link className="admin-profile-back-link" href={adminPagePath(tenantSlug, "")}>返回管理后台</Link><AdminLogoutButton /></div></header>
    <div className="admin-shell admin-theme-shell">
      <div className="admin-heading"><div><span className="eyebrow">QIANLIN TRAVEL / THEME STUDIO</span><h1>网站可视化编辑器</h1><p>调整网站的模板、颜色、字体、按钮和卡片样式。修改会先保存为草稿，只有发布后才会应用到正式网站。</p></div></div>
      <div className="admin-theme-layout">
        <section className="admin-card admin-theme-controls" aria-label="主题编辑">
          <div className="admin-card-heading"><div><span className="eyebrow">主题设置</span><h2>编辑网站样式</h2></div><span className="admin-theme-status">草稿版本 v{state.draft.version}</span></div>
          <SelectField label="网站模板" value={draft.templateKey} options={state.availablePresets.map((preset) => preset.key)} optionLabels={TEMPLATE_LABELS} disabled={disabled} onChange={(value) => updateDraft("templateKey", value)} />
          <div className="admin-theme-color-grid">{([['primaryColor', '主色'], ['secondaryColor', '辅助色'], ['accentColor', '强调色'], ['backgroundColor', '背景色']] as const).map(([field, label]) => <label className="admin-theme-color-field" key={field}><span>{label}</span><input type="color" value={draft[field]} disabled={disabled} onChange={(event) => updateDraft(field, event.target.value)} /><code>{draft[field]}</code></label>)}</div>
          <SelectField label="字体风格" value={draft.fontPreset} options={["modern", "elegant", "editorial", "friendly"]} optionLabels={FONT_LABELS} disabled={disabled} onChange={(value) => updateDraft("fontPreset", value)} />
          <div className="admin-theme-select-grid"><SelectField label="按钮样式" value={draft.buttonStyle} options={["rounded", "square", "pill"]} optionLabels={BUTTON_LABELS} disabled={disabled} onChange={(value) => updateDraft("buttonStyle", value)} /><SelectField label="卡片样式" value={draft.cardStyle} options={["flat", "bordered", "elevated"]} optionLabels={CARD_LABELS} disabled={disabled} onChange={(value) => updateDraft("cardStyle", value)} /><SelectField label="区块样式" value={draft.sectionStyle} options={["clean", "soft", "contrast"]} optionLabels={SECTION_LABELS} disabled={disabled} onChange={(value) => updateDraft("sectionStyle", value)} /></div>
          <div className="admin-theme-actions"><button type="button" className="button button-dark" disabled={disabled} onClick={() => void saveDraft()}>{pending === "/draft" ? "保存中…" : "保存草稿"}</button><button type="button" className="button button-light" disabled={disabled} onClick={() => void resetDraft()}>恢复已发布版本</button>{canPublish ? <button type="button" className="button button-light" disabled={Boolean(pending)} onClick={() => void publish()}>{pending === "/publish" ? "发布中…" : "发布到官网"}</button> : null}</div>
          {!canEdit ? <p className="admin-theme-note">You have read-only access to this theme.</p> : null}
          {message ? <p className="admin-save-success" role="status">{message}</p> : null}
          {error ? <p className="admin-form-error" role="alert">{error}</p> : null}
        </section>
        <section className="admin-card admin-theme-preview-card"><div className="admin-card-heading"><div><span className="eyebrow">实时预览</span><h2>网站效果预览</h2></div><div className="admin-theme-preview-switcher"><button type="button" className={mode === "desktop" ? "active" : ""} onClick={() => setMode("desktop")}>电脑端</button><button type="button" className={mode === "mobile" ? "active" : ""} onClick={() => setMode("mobile")}>手机端</button></div></div><p className="admin-theme-note">这里显示当前草稿的效果。正式网站仍然使用已发布的主题，只有点击“发布到官网”后才会更新。</p><PreviewCanvas values={draft} mode={mode} /></section>
      </div>
    </div>
  </main>;
}
