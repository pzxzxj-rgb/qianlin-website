import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { adminAuditLogs } from "../../db/schema";
import { assertTenantScope } from "./tenantScope";

export type AdminAuditInput = {
  tenantId: string;
  userId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  result: "success" | "failure";
  metadata?: Record<string, string | number | boolean | null>;
};

export async function recordAdminAudit(input: AdminAuditInput) {
  assertTenantScope(input.tenantId);
  if (!input.action || !input.resourceType) throw new Error("Invalid audit context");
  const metadata = input.metadata ? JSON.stringify(input.metadata) : "";
  const db = await getDb();
  await db.insert(adminAuditLogs).values({ tenantId: input.tenantId, userId: input.userId, action: input.action, resourceType: input.resourceType, resourceId: input.resourceId ?? null, result: input.result, metadata });
}

export async function listAdminAuditLogs(tenantId: string, userId: string, limit = 100) {
  assertTenantScope(tenantId);
  const db = await getDb();
  return db.select().from(adminAuditLogs).where(and(eq(adminAuditLogs.tenantId, tenantId), eq(adminAuditLogs.userId, userId))).orderBy(desc(adminAuditLogs.createdAt), desc(adminAuditLogs.id)).limit(Math.min(Math.max(limit, 1), 100));
}
