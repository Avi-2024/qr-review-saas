import { requireMerchantApiIdentity } from "@/server/auth/merchant-session";
import { getBillingService } from "@/server/bootstrap/billing-container";
import { handleRouteError, ok } from "@/server/http/response";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { identity } = await requireMerchantApiIdentity();
    const service = getBillingService();
    const [subscription, plans] = await Promise.all([
      service.getSnapshot(identity.organizationId),
      service.listPlans(),
    ]);
    return ok({ subscription, plans });
  } catch (error) {
    return handleRouteError(error);
  }
}
