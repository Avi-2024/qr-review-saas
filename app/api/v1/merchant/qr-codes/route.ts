import { requireMerchantApiIdentity } from "@/server/auth/merchant-session";
import { getMerchantService } from "@/server/bootstrap/merchant-container";
import { created, handleRouteError, ok } from "@/server/http/response";
import { merchantQrCreateSchema } from "@/server/http/merchant-schemas";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { identity } = await requireMerchantApiIdentity();
    return ok({ qrCodes: await getMerchantService().listQrCodes(identity) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { identity } = await requireMerchantApiIdentity();
    const body = merchantQrCreateSchema.parse(await request.json());
    return created({ qrCode: await getMerchantService().createQrCode(identity, body) });
  } catch (error) {
    return handleRouteError(error);
  }
}
