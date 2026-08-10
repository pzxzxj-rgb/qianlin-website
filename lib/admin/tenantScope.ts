const TENANT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function assertTenantScope(tenantId: string) {
  if (!TENANT_ID_PATTERN.test(tenantId)) throw new Error("Invalid tenant scope");
}
