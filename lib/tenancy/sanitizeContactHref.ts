const ALLOWED_PROTOCOLS = new Set(["tel:", "mailto:", "https:"]);

export function sanitizeContactHref(href: string | null | undefined): string | undefined {
  const value = href?.trim();
  if (!value) return undefined;

  try {
    const protocol = new URL(value).protocol.toLowerCase();
    return ALLOWED_PROTOCOLS.has(protocol) ? value : undefined;
  } catch {
    return undefined;
  }
}
