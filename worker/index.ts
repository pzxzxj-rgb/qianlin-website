/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { anonymizeExpiredInquiries } from "../lib/inquiries/retention";
import { processDueInquirySyncJobs, reconcileMissingInquirySyncJobs, reportInquirySyncQueueHealth } from "../lib/inquiries/syncService";
import { cleanupExpiredSessions } from "../lib/admin/sessionMaintenance";
import { getAppEnvironment } from "../lib/runtime/environment";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  APP_ENV: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function createCspNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

function contentSecurityPolicy(nonce: string) {
  return `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; script-src 'self' 'nonce-${nonce}' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com`;
}

function withSecurityHeaders(response: Response, request: Request, appEnv: Awaited<ReturnType<typeof getAppEnvironment>>, nonce: string) {
  const headers = new Headers(response.headers);
  headers.set("Content-Security-Policy", contentSecurityPolicy(nonce));
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  if (new URL(request.url).protocol === "https:" && appEnv === "production") headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const appEnv = await getAppEnvironment();
    const nonce = createCspNonce();
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("Content-Security-Policy", contentSecurityPolicy(nonce));
    const requestWithCsp = new Request(request, { headers: requestHeaders });

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return withSecurityHeaders(await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths), request, appEnv, nonce);
    }

    return withSecurityHeaders(await handler.fetch(requestWithCsp, env, ctx), request, appEnv, nonce);
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil((async () => {
      const anonymized = await anonymizeExpiredInquiries(env.DB);
      const sessions = await cleanupExpiredSessions();
      const compensated = await reconcileMissingInquirySyncJobs();
      const processed = await processDueInquirySyncJobs();
      const queueHealth = await reportInquirySyncQueueHealth();
      console.log(JSON.stringify({ event: "inquiry_maintenance_completed", anonymized, sessions, compensated, processed, queueHealth }));
    })().catch((error) => {
      console.error("Failed to run inquiry maintenance", error instanceof Error ? error.name : "UnknownError");
    }));
  },
};

export default worker;
