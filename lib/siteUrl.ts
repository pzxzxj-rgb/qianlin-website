const LOCAL_SITE_URL = "http://localhost:3000";

export function getSiteUrl(options: { strict?: boolean } = {}) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const strict = options.strict ?? process.env.NODE_ENV === "production";
  if (!configured) {
    if (strict) throw new Error("NEXT_PUBLIC_SITE_URL must be set to the public production URL.");
    return LOCAL_SITE_URL;
  }

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new Error("NEXT_PUBLIC_SITE_URL must be a valid http or https URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("NEXT_PUBLIC_SITE_URL must use http or https.");
  return configured.replace(/\/$/, "");
}
