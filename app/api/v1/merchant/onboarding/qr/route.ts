import { requireMerchantApiIdentity } from "@/server/auth/merchant-session";
import { getMerchantService } from "@/server/bootstrap/merchant-container";
import { created, handleRouteError } from "@/server/http/response";
import { merchantOnboardingQrSchema } from "@/server/http/merchant-schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { identity } = await requireMerchantApiIdentity();
    const body = merchantOnboardingQrSchema.parse(await request.json());
    return created({ qrCode: await getMerchantService().createOnboardingQrCode(identity, body) });
  } catch (error) {
    return handleRouteError(error);
  }
}
