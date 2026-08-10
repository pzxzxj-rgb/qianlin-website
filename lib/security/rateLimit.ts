type RateLimitBucket = { count: number; resetAt: number };

const buckets = new Map<string, RateLimitBucket>();

export function getRequestAddress(request: Request) {
  const cloudflareAddress = request.headers.get("CF-Connecting-IP")?.trim();
  if (cloudflareAddress) return cloudflareAddress;
  const forwardedAddress = request.headers.get("X-Forwarded-For")?.split(",", 1)[0]?.trim();
  return forwardedAddress || "unknown";
}

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: Math.ceil(windowMs / 1000) };
  }
  current.count += 1;
  if (current.count > limit) return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  return { allowed: true, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
}

export function clearRateLimit(key: string) {
  buckets.delete(key);
}
