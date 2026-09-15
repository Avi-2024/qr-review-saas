import { requireMerchantApiIdentity } from "@/server/auth/merchant-session";
import { getBillingService } from "@/server/bootstrap/billing-container";
import { getMerchantService } from "@/server/bootstrap/merchant-container";
import { created, handleRouteError } from "@/server/http/response";
import { merchantOnboardingLocationSchema } from "@/server/http/merchant-schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { identity } = await requireMerchantApiIdentity();
    const body = merchantOnboardingLocationSchema.parse(await request.json());
    await getBillingService().assertLocationCapacity(identity.organizationId);
    return created({ location: await getMerchantService().createOnboardingLocation(identity, body) });
  } catch (error) {
    return handleRouteError(error);
  }
}
