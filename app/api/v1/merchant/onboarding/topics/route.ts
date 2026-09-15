import { requireMerchantApiIdentity } from "@/server/auth/merchant-session";
import { getBillingService } from "@/server/bootstrap/billing-container";
import { getMerchantService } from "@/server/bootstrap/merchant-container";
import { handleRouteError, ok } from "@/server/http/response";
import { merchantOnboardingTopicsSchema } from "@/server/http/merchant-schemas";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  try {
    const { identity } = await requireMerchantApiIdentity();
    const body = merchantOnboardingTopicsSchema.parse(await request.json());
    await getBillingService().assertCanWrite(identity.organizationId);
    return ok({ topics: await getMerchantService().saveOnboardingTopics(identity, body) });
  } catch (error) {
    return handleRouteError(error);
  }
}
