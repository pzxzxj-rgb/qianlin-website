import type { AdminRole } from "./auth";

export const ADMIN_PERMISSIONS = [
  "inquiry:list_masked",
  "inquiry:read_sensitive",
  "inquiry:update",
  "inquiry:sync_retry",
] as const;

export type AdminPermission = typeof ADMIN_PERMISSIONS[number];

const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  viewer: ["inquiry:list_masked"],
  editor: ["inquiry:list_masked", "inquiry:read_sensitive", "inquiry:update"],
  admin: ["inquiry:list_masked", "inquiry:read_sensitive", "inquiry:update", "inquiry:sync_retry"],
  owner: ["inquiry:list_masked", "inquiry:read_sensitive", "inquiry:update", "inquiry:sync_retry"],
};

export function hasAdminPermission(role: AdminRole, permission: AdminPermission) {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function permissionsForAdminRole(role: AdminRole) {
  return ROLE_PERMISSIONS[role] ?? [];
}
