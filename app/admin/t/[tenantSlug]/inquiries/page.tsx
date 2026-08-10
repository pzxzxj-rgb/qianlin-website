import AdminInquiriesPage from "@/app/admin/inquiries/page";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function TenantAdminInquiriesPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  return AdminInquiriesPage({ tenantSlug });
}
