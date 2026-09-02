import { requireMerchantApiIdentity } from "@/server/auth/merchant-session";
import { getMerchantService } from "@/server/bootstrap/merchant-container";
import { handleRouteError, ok } from "@/server/http/response";
import { merchantOnboardingBusinessSchema } from "@/server/http/merchant-schemas";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    const { identity } = await requireMerchantApiIdentity();
    const body = merchantOnboardingBusinessSchema.parse(await request.json());
    return ok({ organization: await getMerchantService().saveOnboardingBusiness(identity, body) });
  } catch (error) {
    return handleRouteError(error);
  }
}
