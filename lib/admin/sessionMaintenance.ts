import { lt, or } from "drizzle-orm";
import { getDb } from "../../db";
import { sessions } from "../../db/schema";

const REVOKED_SESSION_RETENTION_SECONDS = 7 * 24 * 60 * 60;

export async function cleanupExpiredSessions(now = Math.floor(Date.now() / 1000)) {
  const db = await getDb();
  const cutoff = now - REVOKED_SESSION_RETENTION_SECONDS;
  const deleted = await db.delete(sessions).where(or(
    lt(sessions.expiresAt, now),
    lt(sessions.revokedAt, cutoff),
  )).returning({ id: sessions.id });
  return deleted.length;
}
