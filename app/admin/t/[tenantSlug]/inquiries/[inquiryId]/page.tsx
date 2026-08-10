import AdminInquiryDetailPage from "@/app/admin/inquiries/[inquiryId]/page";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function TenantAdminInquiryDetailPage({ params }: { params: Promise<{ tenantSlug: string; inquiryId: string }> }) {
  const values = await params;
  return AdminInquiryDetailPage({ params: Promise.resolve({ inquiryId: values.inquiryId }), tenantSlug: values.tenantSlug });
}
