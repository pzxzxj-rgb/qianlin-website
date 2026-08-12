import assert from "node:assert/strict";
import {
  RATE_LIMIT_MAX_BUCKETS,
  checkRateLimit,
  getRateLimitBucketCount,
  getRequestAddress,
  resetRateLimitForTests,
} from "../lib/security/rateLimit.ts";

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function main() {
  resetRateLimitForTests();
  (process.env as Record<string, string | undefined>).NODE_ENV = "test";
  assert.equal(getRequestAddress(new Request("https://test.invalid", { headers: { "CF-Connecting-IP": "203.0.113.10", "X-Forwarded-For": "198.51.100.10" } })), "cf:203.0.113.10");
  assert.equal(getRequestAddress(new Request("https://test.invalid", { headers: { "X-Forwarded-For": "198.51.100.11, 198.51.100.12" } })), "local:198.51.100.11");
  (process.env as Record<string, string | undefined>).NODE_ENV = "production";
  assert.equal(getRequestAddress(new Request("https://test.invalid", { headers: { "X-Forwarded-For": "198.51.100.13" } })), "unknown");

  resetRateLimitForTests();
  for (let index = 0; index < RATE_LIMIT_MAX_BUCKETS + 250; index += 1) checkRateLimit(`tenant-${index}-address`, 1, 60_000);
  assert.ok(getRateLimitBucketCount() <= RATE_LIMIT_MAX_BUCKETS);

  resetRateLimitForTests();
  checkRateLimit("expired", 1, 5);
  await wait(15);
  checkRateLimit("fresh", 1, 60_000);
  assert.equal(getRateLimitBucketCount(), 1);

  resetRateLimitForTests();
  assert.equal(checkRateLimit("bounded", 1, 60_000).allowed, true);
  const blocked = checkRateLimit("bounded", 1, 60_000);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds >= 1);
  console.log("Rate-limit integration passed: trusted IP precedence, production X-Forwarded-For rejection, expiry cleanup, bounded capacity, and stable 429 state.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
