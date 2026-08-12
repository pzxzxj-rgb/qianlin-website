type RateLimitBucket = { count: number; resetAt: number };

const buckets = new Map<string, RateLimitBucket>();
export const RATE_LIMIT_MAX_BUCKETS = 10_000;
const MAX_RATE_LIMIT_KEY_LENGTH = 256;
const MAX_ADDRESS_LENGTH = 128;

function normalizePart(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim().slice(0, MAX_ADDRESS_LENGTH) ?? "";
  return normalized || fallback;
}

function looksLikeAddress(value: string) {
  return value.length <= MAX_ADDRESS_LENGTH && /^[0-9a-f:.]+$/i.test(value);
}

export function getRequestAddress(request: Request) {
  const cloudflareAddress = normalizePart(request.headers.get("CF-Connecting-IP"), "");
  if (cloudflareAddress && looksLikeAddress(cloudflareAddress)) return `cf:${cloudflareAddress}`;
  const runtime = typeof process !== "undefined" ? process.env.NODE_ENV : undefined;
  const allowLocalForwardedFallback = runtime === "development" || runtime === "test" || runtime === "local";
  if (allowLocalForwardedFallback) {
    const forwardedAddress = normalizePart(request.headers.get("X-Forwarded-For")?.split(",", 1)[0], "");
    if (forwardedAddress && looksLikeAddress(forwardedAddress)) return `local:${forwardedAddress}`;
  }
  return "unknown";
}

function pruneExpired(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function makeRoom(now: number) {
  pruneExpired(now);
  if (buckets.size < RATE_LIMIT_MAX_BUCKETS) return;
  const oldest = [...buckets.entries()].sort((left, right) => left[1].resetAt - right[1].resetAt)[0];
  if (oldest) buckets.delete(oldest[0]);
}

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const safeKey = key.trim().slice(0, MAX_RATE_LIMIT_KEY_LENGTH) || "unknown";
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 1;
  const safeWindowMs = Number.isFinite(windowMs) && windowMs > 0 ? Math.floor(windowMs) : 1;
  const current = buckets.get(safeKey);
  if (!current || current.resetAt <= now) {
    makeRoom(now);
    buckets.set(safeKey, { count: 1, resetAt: now + safeWindowMs });
    return { allowed: true, retryAfterSeconds: Math.ceil(safeWindowMs / 1000) };
  }
  current.count += 1;
  if (current.count > safeLimit) return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  return { allowed: true, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
}

export function clearRateLimit(key: string) {
  buckets.delete(key.trim().slice(0, MAX_RATE_LIMIT_KEY_LENGTH));
}

export function getRateLimitBucketCount() {
  pruneExpired(Date.now());
  return buckets.size;
}

export function resetRateLimitForTests() {
  buckets.clear();
}
