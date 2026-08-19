import { and, eq, gt, isNull, ne } from "drizzle-orm";
import { getDb } from "../../db";
import { sessions, tenantMemberships, tenants, users } from "../../db/schema";
import { hasAdminPermission, type AdminPermission } from "./permissions";
import { getAppEnvironment } from "../runtime/environment";

const ADMIN_SESSION_COOKIE = "qianlin_admin_session";
const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60;
const PBKDF2_ALGORITHM = "pbkdf2-sha256";
const ADMIN_TENANT_ENV = "ADMIN_TENANT_ID";
export const SUPPORTED_ADMIN_TENANT_ID = "qianlin-travel";

export const ADMIN_ROLES = ["owner", "admin", "editor", "viewer"] as const;
export type AdminRole = typeof ADMIN_ROLES[number];

export type AdminSession = {
  sessionId: string;
  userId: string;
  username: string;
  expiresAt: number;
  tenantId: string;
  tenantSlug: string;
  role: AdminRole;
};

export type AdminAccessContext = AdminSession & {
  tenantNameZh: string;
  tenantNameEn: string;
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

async function digestBase64Url(value: string) {
  return encodeBase64Url(new Uint8Array(await getSubtleCrypto().digest("SHA-256", new TextEncoder().encode(value))));
}

function randomToken(bytes = 32) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return encodeBase64Url(value);
}

async function getRuntimeVariable(name: string) {
  try {
    const { env } = await import("cloudflare:workers");
    const workerValue = (env as unknown as Record<string, unknown>)[name];
    if (typeof workerValue === "string" && workerValue.trim()) return workerValue.trim();
  } catch {
    // Node-based local callers use process.env below.
  }
  return typeof process !== "undefined" ? process.env[name]?.trim() ?? "" : "";
}

async function getLegacyAdminConfig() {
  const [username, passwordHash, tenantId] = await Promise.all([
    getRuntimeVariable("ADMIN_USERNAME"),
    getRuntimeVariable("ADMIN_PASSWORD_HASH"),
    getRuntimeVariable(ADMIN_TENANT_ENV),
  ]);
  return { username, passwordHash, tenantId };
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function parsePasswordHash(passwordHash: string) {
  const [algorithm, iterationsText, saltText, expectedText] = passwordHash.split("$");
  const iterations = Number(iterationsText);
  if (algorithm !== PBKDF2_ALGORITHM || !Number.isSafeInteger(iterations) || iterations < 100_000 || iterations > 2_000_000) return null;
  try {
    const salt = decodeBase64Url(saltText);
    const expected = decodeBase64Url(expectedText);
    if (salt.length < 16 || expected.length < 16 || expected.length > 64) return null;
    return { iterations, salt, expected };
  } catch {
    return null;
  }
}

async function verifyPasswordHash(password: string, passwordHash: string) {
  const parsed = parsePasswordHash(passwordHash);
  if (!parsed) return false;
  try {
    const passwordKey = await getSubtleCrypto().importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const derived = new Uint8Array(await getSubtleCrypto().deriveBits({ name: "PBKDF2", salt: parsed.salt, iterations: parsed.iterations, hash: "SHA-256" }, passwordKey, parsed.expected.length * 8));
    let difference = derived.length === parsed.expected.length ? 0 : 1;
    for (let index = 0; index < Math.min(derived.length, parsed.expected.length); index += 1) difference |= derived[index] ^ parsed.expected[index];
    return difference === 0;
  } catch {
    return false;
  }
}

export async function createPasswordHash(password: string) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const passwordKey = await getSubtleCrypto().importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = new Uint8Array(await getSubtleCrypto().deriveBits({ name: "PBKDF2", salt, iterations: 600_000, hash: "SHA-256" }, passwordKey, 256));
  return `${PBKDF2_ALGORITHM}$600000$${encodeBase64Url(salt)}$${encodeBase64Url(derived)}`;
}

export async function isAdminConfigured() {
  const config = await getLegacyAdminConfig();
  if (config.username && parsePasswordHash(config.passwordHash) && config.tenantId === SUPPORTED_ADMIN_TENANT_ID) return true;
  try {
    const db = await getDb();
    const rows = await db.select({ id: users.id }).from(users)
      .innerJoin(tenantMemberships, eq(tenantMemberships.userId, users.id))
      .where(and(eq(users.status, "active"), eq(tenantMemberships.status, "active"), eq(tenantMemberships.tenantId, SUPPORTED_ADMIN_TENANT_ID)))
      .limit(1);
    return Boolean(rows[0]);
  } catch {
    return false;
  }
}

async function findUserByUsername(username: string) {
  const db = await getDb();
  const rows = await db.select().from(users).where(and(eq(users.username, username), eq(users.status, "active"))).limit(1);
  return rows[0] ?? null;
}

async function migrateLegacyAdmin() {
  const config = await getLegacyAdminConfig();
  if (!config.username || !config.passwordHash || config.tenantId !== SUPPORTED_ADMIN_TENANT_ID) return null;
  const db = await getDb();
  const [tenant] = await db.select({ id: tenants.id }).from(tenants).where(and(eq(tenants.id, config.tenantId), eq(tenants.status, "active"))).limit(1);
  if (!tenant) return null;

  let user = await findUserByUsername(config.username);
  if (!user) {
    try {
      await db.insert(users).values({ id: "user-" + randomToken(18), username: config.username, passwordHash: config.passwordHash, displayNameZh: config.username, displayNameEn: config.username, status: "active" });
    } catch {
      // A concurrent first login may have completed the migration.
    }
    user = await findUserByUsername(config.username);
  }
  if (!user) return null;

  const memberships = await db.select({ id: tenantMemberships.id }).from(tenantMemberships).where(and(eq(tenantMemberships.tenantId, tenant.id), eq(tenantMemberships.userId, user.id))).limit(1);
  if (!memberships[0]) {
    await db.insert(tenantMemberships).values({ id: "membership-" + randomToken(18), tenantId: tenant.id, userId: user.id, role: "owner", status: "active" });
  }
  return user;
}

export async function verifyAdminCredentials(username: string, password: string) {
  const existingUser = await findUserByUsername(username).catch(() => null);
  if (existingUser) {
    if (!(await verifyPasswordHash(password, existingUser.passwordHash))) return null;
    const db = await getDb();
    const [membership] = await db.select({ id: tenantMemberships.id }).from(tenantMemberships)
      .where(and(eq(tenantMemberships.userId, existingUser.id), eq(tenantMemberships.tenantId, SUPPORTED_ADMIN_TENANT_ID), eq(tenantMemberships.status, "active")))
      .limit(1);
    return membership ? existingUser : null;
  }

  const config = await getLegacyAdminConfig();
  if (!config.username || username !== config.username || !(await verifyPasswordHash(password, config.passwordHash))) return null;
  return await migrateLegacyAdmin();
}

export async function createAdminSession(userId: string) {
  const db = await getDb();
  const [membership] = await db.select({ id: tenantMemberships.id }).from(tenantMemberships)
    .where(and(eq(tenantMemberships.userId, userId), eq(tenantMemberships.tenantId, SUPPORTED_ADMIN_TENANT_ID), eq(tenantMemberships.status, "active")))
    .limit(1);
  if (!membership) throw new Error("Admin user is not a member of the supported tenant");
  const token = randomToken();
  const sessionId = "session-" + randomToken(18);
  const expiresAt = Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SECONDS;
  await db.insert(sessions).values({ id: sessionId, userId, tokenHash: await digestBase64Url(token), expiresAt });
  await db.update(users).set({ lastLoginAt: new Date().toISOString() }).where(eq(users.id, userId));
  return token;
}

function getCookieToken(cookieHeader: string | null | undefined) {
  const cookie = cookieHeader?.split(";").map((item) => item.trim()).find((item) => item.startsWith(ADMIN_SESSION_COOKIE + "="));
  return cookie?.slice(ADMIN_SESSION_COOKIE.length + 1) ?? "";
}

async function getSessionRows(token: string) {
  if (!token) return [];
  const db = await getDb();
  return db.select({
    sessionId: sessions.id,
    userId: users.id,
    username: users.username,
    expiresAt: sessions.expiresAt,
    tenantId: tenantMemberships.tenantId,
    tenantSlug: tenants.slug,
    role: tenantMemberships.role,
    tenantNameZh: tenants.nameZh,
    tenantNameEn: tenants.nameEn,
  }).from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(tenantMemberships, eq(tenantMemberships.userId, users.id))
    .innerJoin(tenants, eq(tenants.id, tenantMemberships.tenantId))
    .where(and(eq(sessions.tokenHash, await digestBase64Url(token)), isNull(sessions.revokedAt), gt(sessions.expiresAt, Math.floor(Date.now() / 1000)), eq(users.status, "active"), eq(tenantMemberships.status, "active"), eq(tenantMemberships.tenantId, SUPPORTED_ADMIN_TENANT_ID), eq(tenants.id, SUPPORTED_ADMIN_TENANT_ID), eq(tenants.status, "active")))
    .limit(20);
}

function isAdminRole(value: string): value is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(value);
}

export async function getAdminSessionFromCookie(cookieHeader: string | null | undefined): Promise<AdminSession | null> {
  const rows = await getSessionRows(getCookieToken(cookieHeader)).catch(() => []);
  const row = rows.find((candidate) => isAdminRole(candidate.role));
  if (!row || !isAdminRole(row.role)) return null;
  return { sessionId: row.sessionId, userId: row.userId, username: row.username, expiresAt: row.expiresAt, tenantId: row.tenantId, tenantSlug: row.tenantSlug, role: row.role };
}

export async function requireAdminSession(request: Request) {
  return getAdminSessionFromCookie(request.headers.get("cookie"));
}

export async function requireAdminAccess(request: Request, tenantSlug: string, minimumRole: AdminRole = "viewer", requiredPermission?: AdminPermission): Promise<AdminAccessContext | null> {
  const session = await requireAdminSession(request);
  if (!session || session.tenantId !== SUPPORTED_ADMIN_TENANT_ID || !tenantSlug || tenantSlug !== SUPPORTED_ADMIN_TENANT_ID || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tenantSlug)) return null;
  const db = await getDb();
  const [row] = await db.select({
    tenantId: tenants.id,
    tenantSlug: tenants.slug,
    tenantNameZh: tenants.nameZh,
    tenantNameEn: tenants.nameEn,
    role: tenantMemberships.role,
  }).from(tenantMemberships)
    .innerJoin(tenants, eq(tenants.id, tenantMemberships.tenantId))
    .innerJoin(users, eq(users.id, tenantMemberships.userId))
    .innerJoin(sessions, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, session.sessionId), eq(tenantMemberships.tenantId, tenants.id), eq(tenantMemberships.tenantId, SUPPORTED_ADMIN_TENANT_ID), eq(tenants.id, SUPPORTED_ADMIN_TENANT_ID), eq(tenants.slug, tenantSlug), eq(tenants.status, "active"), eq(users.status, "active"), eq(tenantMemberships.status, "active"), eq(tenantMemberships.userId, session.userId), isNull(sessions.revokedAt), gt(sessions.expiresAt, Math.floor(Date.now() / 1000)))).limit(1);
  if (!row || !isAdminRole(row.role)) return null;
  const roleRank: Record<AdminRole, number> = { viewer: 1, editor: 2, admin: 3, owner: 4 };
  if (roleRank[row.role] < roleRank[minimumRole]) return null;
  if (requiredPermission && !hasAdminPermission(row.role, requiredPermission)) return null;
  return { ...session, tenantId: row.tenantId, tenantSlug: row.tenantSlug, role: row.role, tenantNameZh: row.tenantNameZh, tenantNameEn: row.tenantNameEn };
}

export function requireAdminTenant(session: AdminSession) {
  if (!session.tenantId) throw new Error("Admin session has no tenant membership");
  return session.tenantId;
}

export async function revokeAdminSession(request: Request) {
  const token = getCookieToken(request.headers.get("cookie"));
  if (!token) return;
  const db = await getDb();
  await db.update(sessions).set({ revokedAt: Math.floor(Date.now() / 1000) }).where(and(eq(sessions.tokenHash, await digestBase64Url(token)), isNull(sessions.revokedAt)));
}

export async function revokeAllAdminSessions(userId: string, exceptSessionId?: string) {
  const db = await getDb();
  const conditions = [eq(sessions.userId, userId), isNull(sessions.revokedAt)];
  if (exceptSessionId) conditions.push(ne(sessions.id, exceptSessionId));
  await db.update(sessions).set({ revokedAt: Math.floor(Date.now() / 1000) }).where(and(...conditions));
}

export async function changeAdminPassword(userId: string, currentPassword: string, nextPassword: string) {
  const db = await getDb();
  const [user] = await db.select({ id: users.id, passwordHash: users.passwordHash }).from(users).where(and(eq(users.id, userId), eq(users.status, "active"))).limit(1);
  if (!user || !(await verifyPasswordHash(currentPassword, user.passwordHash))) return false;
  await db.update(users).set({ passwordHash: await createPasswordHash(nextPassword), updatedAt: new Date().toISOString() }).where(and(eq(users.id, userId), eq(users.status, "active")));
  await revokeAllAdminSessions(userId);
  return true;
}

async function secureCookieAttribute() {
  return (await getAppEnvironment()) === "production" ? "; Secure" : "";
}

export async function createAdminCookie(token: string) {
  return ADMIN_SESSION_COOKIE + "=" + token + "; HttpOnly; Path=/; SameSite=Lax; Max-Age=" + ADMIN_SESSION_TTL_SECONDS + await secureCookieAttribute();
}

export async function clearAdminCookie() {
  return ADMIN_SESSION_COOKIE + "=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0" + await secureCookieAttribute();
}

export { ADMIN_SESSION_COOKIE, ADMIN_SESSION_TTL_SECONDS, verifyPasswordHash };
