import { requireMerchantApiIdentity } from "@/server/auth/merchant-session";
import { getBillingService } from "@/server/bootstrap/billing-container";
import { getMerchantService } from "@/server/bootstrap/merchant-container";
import { handleRouteError, ok } from "@/server/http/response";
import { merchantLocationUpdateSchema } from "@/server/http/merchant-schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ locationId: string }> },
) {
  try {
    const { identity } = await requireMerchantApiIdentity();
    const { locationId } = await context.params;
    const location = await getMerchantService().getLocation(identity, locationId);
    return ok({ location }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ locationId: string }> },
) {
  try {
    const { identity } = await requireMerchantApiIdentity();
    const { locationId } = await context.params;
    const body = merchantLocationUpdateSchema.parse(await request.json());
    await getBillingService().assertCanWrite(identity.organizationId);
    return ok({ location: await getMerchantService().updateLocation(identity, locationId, body) });
  } catch (error) {
    return handleRouteError(error);
  }
}
