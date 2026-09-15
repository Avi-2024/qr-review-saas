import { requireMerchantApiIdentity } from "@/server/auth/merchant-session";
import { getBillingService } from "@/server/bootstrap/billing-container";
import { getMerchantService } from "@/server/bootstrap/merchant-container";
import { handleRouteError, ok } from "@/server/http/response";

export const runtime = "nodejs";

export async function POST() {
  try {
    const { identity } = await requireMerchantApiIdentity();
    await getBillingService().assertCanWrite(identity.organizationId);
    return ok({ organization: await getMerchantService().completeOnboarding(identity) });
  } catch (error) {
    return handleRouteError(error);
  }
}
