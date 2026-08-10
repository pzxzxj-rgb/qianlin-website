export function adminPagePath(tenantSlug: string | undefined, path: string) {
  return tenantSlug ? `/admin/t/${encodeURIComponent(tenantSlug)}${path}` : path;
}

export function adminApiPath(tenantSlug: string | undefined, path: string) {
  return tenantSlug ? `/api/admin/t/${encodeURIComponent(tenantSlug)}${path}` : path;
}
