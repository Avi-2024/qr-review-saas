import { requireMerchantApiIdentity } from "@/server/auth/merchant-session";
import { getMerchantService } from "@/server/bootstrap/merchant-container";
import { handleRouteError, ok } from "@/server/http/response";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { identity } = await requireMerchantApiIdentity();
    const standees = await getMerchantService().listStandees(identity);
    return ok({ standees });
  } catch (error) {
    return handleRouteError(error);
  }
}
