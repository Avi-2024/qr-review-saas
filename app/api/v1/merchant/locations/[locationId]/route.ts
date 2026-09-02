import { requireMerchantApiIdentity } from "@/server/auth/merchant-session";
import { getMerchantService } from "@/server/bootstrap/merchant-container";
import { handleRouteError, ok } from "@/server/http/response";
import { merchantLocationUpdateSchema } from "@/server/http/merchant-schemas";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ locationId: string }> },
) {
  try {
    const { identity } = await requireMerchantApiIdentity();
    const { locationId } = await context.params;
    const body = merchantLocationUpdateSchema.parse(await request.json());
    return ok({ location: await getMerchantService().updateLocation(identity, locationId, body) });
  } catch (error) {
    return handleRouteError(error);
  }
}
