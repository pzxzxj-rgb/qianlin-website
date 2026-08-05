import { handleInquiry } from "../../../lib/inquiries/handleInquiry";
import { getDefaultTenant } from "../../../lib/tenancy/resolveTenant";

export async function POST(request: Request) {
  let tenant = null;
  try {
    tenant = await getDefaultTenant();
  } catch (error) {
    console.error("Failed to resolve default inquiry tenant", error instanceof Error ? error.name : "UnknownError");
  }
  return handleInquiry(request, tenant);
}
