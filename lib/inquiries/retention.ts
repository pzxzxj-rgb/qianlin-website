const RETENTION_BATCH_SIZE = 100;

type ExpiredInquiry = { id: number; tenant_id: string };

/**
 * Remove personal and trip details from inquiries whose retention deadline has
 * passed. Every update is scoped by both the trusted tenant id and inquiry id;
 * this job is invoked only by the platform scheduler, never by a client.
 */
export async function anonymizeExpiredInquiries(db: D1Database, now = new Date(), limit = RETENTION_BATCH_SIZE) {
  const safeLimit = Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, RETENTION_BATCH_SIZE) : RETENTION_BATCH_SIZE;
  const nowIso = now.toISOString();
  const due = await db.prepare(`
    SELECT id, tenant_id
    FROM inquiries
    WHERE retention_until IS NOT NULL
      AND retention_until <= ?
      AND anonymized_at IS NULL
    ORDER BY retention_until, id
    LIMIT ?
  `).bind(nowIso, safeLimit).all<ExpiredInquiry>();

  if (due.results.length === 0) return 0;
  const statements = due.results.map((row) => db.prepare(`
    UPDATE inquiries
    SET name = '已匿名化',
        phone = '',
        wechat = '',
        email = '',
        location = '',
        travel_date = '',
        travelers = '',
        duration = '',
        tour_name = '',
        places = '',
        message = '',
        anonymized_at = ?,
        updated_at = ?
    WHERE tenant_id = ?
      AND id = ?
      AND retention_until IS NOT NULL
      AND retention_until <= ?
      AND anonymized_at IS NULL
  `).bind(nowIso, nowIso, row.tenant_id, row.id, nowIso));
  await db.batch(statements);
  return statements.length;
}

export { RETENTION_BATCH_SIZE };
