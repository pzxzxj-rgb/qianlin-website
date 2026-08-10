import AdminToursPage from "@/app/admin/tours/page";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function TenantAdminToursPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  return AdminToursPage({ tenantSlug });
}
