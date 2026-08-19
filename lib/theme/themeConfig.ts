export const THEME_TEMPLATE_KEYS = ["modern", "natural", "elegant", "youthful"] as const;
export const THEME_FONT_PRESETS = ["modern", "elegant", "editorial", "friendly"] as const;
export const THEME_BUTTON_STYLES = ["rounded", "square", "pill"] as const;
export const THEME_CARD_STYLES = ["flat", "bordered", "elevated"] as const;
export const THEME_SECTION_STYLES = ["clean", "soft", "contrast"] as const;

export type ThemeTemplateKey = typeof THEME_TEMPLATE_KEYS[number];
export type ThemeFontPreset = typeof THEME_FONT_PRESETS[number];
export type ThemeButtonStyle = typeof THEME_BUTTON_STYLES[number];
export type ThemeCardStyle = typeof THEME_CARD_STYLES[number];
export type ThemeSectionStyle = typeof THEME_SECTION_STYLES[number];

export type ThemeColors = {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
};

export type ThemeConfig = {
  template: ThemeTemplateKey;
  colors: ThemeColors;
  fontPreset: ThemeFontPreset;
  buttonStyle: ThemeButtonStyle;
  cardStyle: ThemeCardStyle;
  sectionStyle: ThemeSectionStyle;
};

export type ThemeDraftValues = {
  templateKey: ThemeTemplateKey;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  fontPreset: ThemeFontPreset;
  buttonStyle: ThemeButtonStyle;
  cardStyle: ThemeCardStyle;
  sectionStyle: ThemeSectionStyle;
};

export const THEME_DRAFT_FIELDS = [
  "templateKey",
  "primaryColor",
  "secondaryColor",
  "accentColor",
  "backgroundColor",
  "fontPreset",
  "buttonStyle",
  "cardStyle",
  "sectionStyle",
] as const;

export const THEME_PRESETS: Record<ThemeTemplateKey, ThemeConfig> = {
  modern: {
    template: "modern",
    colors: { primary: "#173F36", secondary: "#DCE6DC", accent: "#C7A878", background: "#FBFAF7" },
    fontPreset: "modern",
    buttonStyle: "rounded",
    cardStyle: "elevated",
    sectionStyle: "clean",
  },
  natural: {
    template: "natural",
    colors: { primary: "#3D5A40", secondary: "#E5E0C8", accent: "#C57F4B", background: "#F6F1E5" },
    fontPreset: "friendly",
    buttonStyle: "pill",
    cardStyle: "flat",
    sectionStyle: "soft",
  },
  elegant: {
    template: "elegant",
    colors: { primary: "#2C2A3A", secondary: "#E8E0E0", accent: "#A98564", background: "#FBF8F4" },
    fontPreset: "editorial",
    buttonStyle: "square",
    cardStyle: "bordered",
    sectionStyle: "contrast",
  },
  youthful: {
    template: "youthful",
    colors: { primary: "#244D73", secondary: "#DDEBF3", accent: "#F09B62", background: "#F8FBFD" },
    fontPreset: "friendly",
    buttonStyle: "pill",
    cardStyle: "flat",
    sectionStyle: "soft",
  },
};

export const THEME_PRESET_OPTIONS = THEME_TEMPLATE_KEYS.map((key) => ({
  key,
  label: key[0].toUpperCase() + key.slice(1),
  config: THEME_PRESETS[key],
}));

export const DEFAULT_THEME_CONFIG = THEME_PRESETS.modern;

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export function isThemeHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR_PATTERN.test(value);
}

export function isThemeConfig(value: unknown): value is ThemeConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const colors = candidate.colors;
  if (!colors || typeof colors !== "object" || Array.isArray(colors)) return false;
  const colorValues = colors as Record<string, unknown>;
  return THEME_TEMPLATE_KEYS.includes(candidate.template as ThemeTemplateKey)
    && isThemeHexColor(colorValues.primary)
    && isThemeHexColor(colorValues.secondary)
    && isThemeHexColor(colorValues.accent)
    && isThemeHexColor(colorValues.background)
    && THEME_FONT_PRESETS.includes(candidate.fontPreset as ThemeFontPreset)
    && THEME_BUTTON_STYLES.includes(candidate.buttonStyle as ThemeButtonStyle)
    && THEME_CARD_STYLES.includes(candidate.cardStyle as ThemeCardStyle)
    && THEME_SECTION_STYLES.includes(candidate.sectionStyle as ThemeSectionStyle);
}

export function themeDraftToConfig(values: ThemeDraftValues): ThemeConfig {
  return {
    template: values.templateKey,
    colors: {
      primary: values.primaryColor,
      secondary: values.secondaryColor,
      accent: values.accentColor,
      background: values.backgroundColor,
    },
    fontPreset: values.fontPreset,
    buttonStyle: values.buttonStyle,
    cardStyle: values.cardStyle,
    sectionStyle: values.sectionStyle,
  };
}

export function themeConfigToDraft(config: ThemeConfig): ThemeDraftValues {
  return {
    templateKey: config.template,
    primaryColor: config.colors.primary,
    secondaryColor: config.colors.secondary,
    accentColor: config.colors.accent,
    backgroundColor: config.colors.background,
    fontPreset: config.fontPreset,
    buttonStyle: config.buttonStyle,
    cardStyle: config.cardStyle,
    sectionStyle: config.sectionStyle,
  };
}

export function themeDraftFromRow(row: {
  templateKey: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  fontPreset: string;
  buttonStyle: string;
  cardStyle: string;
  sectionStyle: string;
}): ThemeDraftValues | null {
  const values = {
    templateKey: row.templateKey,
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    accentColor: row.accentColor,
    backgroundColor: row.backgroundColor,
    fontPreset: row.fontPreset,
    buttonStyle: row.buttonStyle,
    cardStyle: row.cardStyle,
    sectionStyle: row.sectionStyle,
  } as unknown as ThemeDraftValues;
  return isThemeConfig(themeDraftToConfig(values)) ? values : null;
}

export function themeCssVariables(config: ThemeConfig) {
  const buttonRadius: Record<ThemeButtonStyle, string> = { rounded: "12px", square: "0px", pill: "999px" };
  const cardShadow: Record<ThemeCardStyle, string> = { flat: "none", bordered: "none", elevated: "0 18px 48px rgba(17, 43, 38, .10)" };
  const cardBorder: Record<ThemeCardStyle, string> = { flat: "0px solid transparent", bordered: "1px solid var(--theme-secondary)", elevated: "0px solid transparent" };
  const sectionSurface: Record<ThemeSectionStyle, string> = { clean: "var(--theme-background)", soft: "var(--theme-secondary)", contrast: "var(--theme-primary)" };
  const fontFamily: Record<ThemeFontPreset, string> = {
    modern: "Arial, Helvetica, sans-serif",
    elegant: "Georgia, 'Times New Roman', serif",
    editorial: "'Trebuchet MS', Arial, sans-serif",
    friendly: "Verdana, Arial, sans-serif",
  };
  return {
    "--theme-primary": config.colors.primary,
    "--theme-secondary": config.colors.secondary,
    "--theme-accent": config.colors.accent,
    "--theme-background": config.colors.background,
    "--theme-font-family": fontFamily[config.fontPreset],
    "--theme-button-radius": buttonRadius[config.buttonStyle],
    "--theme-card-shadow": cardShadow[config.cardStyle],
    "--theme-card-border": cardBorder[config.cardStyle],
    "--theme-section-surface": sectionSurface[config.sectionStyle],
  } as const;
}

export function themeClassNames(config: ThemeConfig) {
  return [
    `theme-template-${config.template}`,
    `theme-button-${config.buttonStyle}`,
    `theme-card-${config.cardStyle}`,
    `theme-section-${config.sectionStyle}`,
    `theme-font-${config.fontPreset}`,
  ].join(" ");
}
