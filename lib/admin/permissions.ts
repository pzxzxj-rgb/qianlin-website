import type { AdminRole } from "./auth";

export const ADMIN_PERMISSIONS = [
  "inquiry:list_masked",
  "inquiry:read_sensitive",
  "inquiry:update",
  "inquiry:sync_retry",
  "theme:read",
  "theme:update_draft",
  "theme:publish",
] as const;

export type AdminPermission = typeof ADMIN_PERMISSIONS[number];

const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  viewer: ["inquiry:list_masked", "theme:read"],
  editor: ["inquiry:list_masked", "inquiry:read_sensitive", "inquiry:update", "theme:read", "theme:update_draft"],
  admin: ["inquiry:list_masked", "inquiry:read_sensitive", "inquiry:update", "inquiry:sync_retry", "theme:read", "theme:update_draft", "theme:publish"],
  owner: ["inquiry:list_masked", "inquiry:read_sensitive", "inquiry:update", "inquiry:sync_retry", "theme:read", "theme:update_draft", "theme:publish"],
};

export function hasAdminPermission(role: AdminRole, permission: AdminPermission) {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function permissionsForAdminRole(role: AdminRole) {
  return ROLE_PERMISSIONS[role] ?? [];
}

export type InquiryPiiVisibility = "masked" | "full";

export function inquiryPiiVisibilityForRole(role: AdminRole): InquiryPiiVisibility {
  return hasAdminPermission(role, "inquiry:read_sensitive") ? "full" : "masked";
}
