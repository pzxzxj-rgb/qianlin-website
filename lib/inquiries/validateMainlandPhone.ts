export const MAINLAND_MOBILE_PATTERN = /^1[3-9]\d{9}$/;

export function normalizeMainlandPhone(value: string) {
  return value.replace(/[\s\-\u2010-\u2015\u2212\uFF0D]/g, "");
}

export function isValidMainlandPhone(value: string) {
  return MAINLAND_MOBILE_PATTERN.test(normalizeMainlandPhone(value));
}
