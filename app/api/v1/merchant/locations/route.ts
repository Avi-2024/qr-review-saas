import { requireMerchantApiIdentity } from "@/server/auth/merchant-session";
import { getMerchantService } from "@/server/bootstrap/merchant-container";
import { handleRouteError, created, ok } from "@/server/http/response";
import { merchantLocationCreateSchema } from "@/server/http/merchant-schemas";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { identity } = await requireMerchantApiIdentity();
    return ok({ locations: await getMerchantService().listLocations(identity) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { identity } = await requireMerchantApiIdentity();
    const body = merchantLocationCreateSchema.parse(await request.json());
    return created({ location: await getMerchantService().createLocation(identity, body) });
  } catch (error) {
    return handleRouteError(error);
  }
}
