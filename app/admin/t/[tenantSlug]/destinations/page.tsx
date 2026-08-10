import AdminDestinationsPage from "@/app/admin/destinations/page";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function TenantAdminDestinationsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  return AdminDestinationsPage({ tenantSlug });
}
