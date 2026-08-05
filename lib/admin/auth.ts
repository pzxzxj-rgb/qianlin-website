const ADMIN_TENANT_ID = "qianlin-travel";
const ADMIN_SESSION_COOKIE = "qianlin_admin_session";
const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60;
const PBKDF2_ALGORITHM = "pbkdf2-sha256";
const MIN_ADMIN_SESSION_SECRET_LENGTH = 32;

export type AdminSession = {
  tenantId: typeof ADMIN_TENANT_ID;
  expiresAt: number;
};

function getSubtleCrypto() {
  if (!globalThis.crypto?.subtle) throw new Error("Web Crypto is unavailable");
  return globalThis.crypto.subtle;
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function equalBytes(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function sign(value: string, secret: string) {
  const key = await getSubtleCrypto().importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return encodeBase64Url(new Uint8Array(await getSubtleCrypto().sign("HMAC", key, new TextEncoder().encode(value))));
}

async function getRuntimeVariable(name: string) {
  const processValue = typeof process !== "undefined" ? process.env[name]?.trim() : "";
  if (processValue) return processValue;
  try {
    const { env } = await import("cloudflare:workers");
    const workerValue = (env as unknown as Record<string, unknown>)[name];
    return typeof workerValue === "string" ? workerValue.trim() : "";
  } catch {
    return "";
  }
}

async function getAdminConfig() {
  const [username, passwordHash, sessionSecret] = await Promise.all([
    getRuntimeVariable("ADMIN_USERNAME"),
    getRuntimeVariable("ADMIN_PASSWORD_HASH"),
    getRuntimeVariable("ADMIN_SESSION_SECRET"),
  ]);
  return { username, passwordHash, sessionSecret };
}

export async function isAdminConfigured() {
  const config = await getAdminConfig();
  return Boolean(config.username && config.passwordHash && config.sessionSecret.length >= MIN_ADMIN_SESSION_SECRET_LENGTH);
}

export async function verifyAdminCredentials(username: string, password: string) {
  const config = await getAdminConfig();
  if (!config.username || !config.passwordHash || username !== config.username) return false;

  const [algorithm, iterationsText, saltText, expectedText] = config.passwordHash.split("$");
  const iterations = Number(iterationsText);
  if (algorithm !== PBKDF2_ALGORITHM || !Number.isSafeInteger(iterations) || iterations < 100_000 || iterations > 2_000_000) return false;

  try {
    const salt = decodeBase64Url(saltText);
    const expected = decodeBase64Url(expectedText);
    if (salt.length < 16 || expected.length < 16 || expected.length > 64) return false;
    const passwordKey = await getSubtleCrypto().importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const derived = new Uint8Array(await getSubtleCrypto().deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, passwordKey, expected.length * 8));
    return equalBytes(derived, expected);
  } catch {
    return false;
  }
}

export async function createAdminSession() {
  const config = await getAdminConfig();
  if (!config.username || !config.passwordHash || config.sessionSecret.length < MIN_ADMIN_SESSION_SECRET_LENGTH) return null;
  const secret = config.sessionSecret;
  const expiresAt = Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SECONDS;
  const payload = JSON.stringify({ tenantId: ADMIN_TENANT_ID, expiresAt });
  return `${encodeBase64Url(new TextEncoder().encode(payload))}.${await sign(payload, secret)}`;
}

export async function getAdminSessionFromCookie(cookieHeader: string | null | undefined): Promise<AdminSession | null> {
  const cookie = cookieHeader?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${ADMIN_SESSION_COOKIE}=`));
  const token = cookie?.slice(ADMIN_SESSION_COOKIE.length + 1);
  const secret = (await getAdminConfig()).sessionSecret;
  if (!token || secret.length < MIN_ADMIN_SESSION_SECRET_LENGTH) return null;

  try {
    const separator = token.lastIndexOf(".");
    if (separator <= 0) return null;
    const payloadText = new TextDecoder().decode(decodeBase64Url(token.slice(0, separator)));
    const signature = decodeBase64Url(token.slice(separator + 1));
    const expectedSignature = decodeBase64Url(await sign(payloadText, secret));
    if (!equalBytes(signature, expectedSignature)) return null;
    const payload = JSON.parse(payloadText) as Partial<AdminSession>;
    if (payload.tenantId !== ADMIN_TENANT_ID || typeof payload.expiresAt !== "number" || payload.expiresAt <= Math.floor(Date.now() / 1000)) return null;
    return { tenantId: ADMIN_TENANT_ID, expiresAt: payload.expiresAt };
  } catch {
    return null;
  }
}

function secureCookieAttribute() {
  return process.env.NODE_ENV === "production" ? "; Secure" : "";
}

export function createAdminCookie(token: string) {
  return `${ADMIN_SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${ADMIN_SESSION_TTL_SECONDS}${secureCookieAttribute()}`;
}

export function clearAdminCookie() {
  return `${ADMIN_SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secureCookieAttribute()}`;
}

export { ADMIN_TENANT_ID };
