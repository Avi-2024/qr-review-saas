import { requireMerchantApiIdentity } from "@/server/auth/merchant-session";
import { getMerchantService } from "@/server/bootstrap/merchant-container";
import { standeeUnbindSchema } from "@/server/http/merchant-schemas";
import { handleRouteError, ok } from "@/server/http/response";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { identity } = await requireMerchantApiIdentity();
    const body = standeeUnbindSchema.parse(await request.json());
    const standee = await getMerchantService().unbindStandee(identity, body.standeeId);
    return ok({ standee });
  } catch (error) {
    return handleRouteError(error);
  }
}
