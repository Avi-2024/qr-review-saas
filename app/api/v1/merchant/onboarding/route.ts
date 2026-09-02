import { requireMerchantApiIdentity } from "@/server/auth/merchant-session";
import { getMerchantService } from "@/server/bootstrap/merchant-container";
import { handleRouteError, ok } from "@/server/http/response";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { identity } = await requireMerchantApiIdentity();
    return ok({ onboarding: await getMerchantService().onboardingState(identity) });
  } catch (error) {
    return handleRouteError(error);
  }
}
