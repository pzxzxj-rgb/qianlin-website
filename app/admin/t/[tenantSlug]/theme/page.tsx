import AdminThemePage from "@/app/admin/theme/page";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function TenantAdminThemePage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  return AdminThemePage({ tenantSlug });
}
