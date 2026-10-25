import { requireMerchantApiIdentity } from "@/server/auth/merchant-session";
import { getMerchantService } from "@/server/bootstrap/merchant-container";
import { standeeAssignSchema } from "@/server/http/merchant-schemas";
import { handleRouteError, ok } from "@/server/http/response";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { identity } = await requireMerchantApiIdentity();
    const body = standeeAssignSchema.parse(await request.json());
    const standee = await getMerchantService().assignStandee(identity, body);
    return ok({ standee });
  } catch (error) {
    return handleRouteError(error);
  }
}
