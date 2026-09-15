import { requireMerchantApiIdentity } from "@/server/auth/merchant-session";
import { getBillingService } from "@/server/bootstrap/billing-container";
import { getMerchantService } from "@/server/bootstrap/merchant-container";
import { handleRouteError, ok } from "@/server/http/response";
import { merchantQrStatusSchema } from "@/server/http/merchant-schemas";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ qrCodeId: string }> },
) {
  try {
    const { identity } = await requireMerchantApiIdentity();
    const { qrCodeId } = await context.params;
    const body = merchantQrStatusSchema.parse(await request.json());
    await getBillingService().assertCanWrite(identity.organizationId);
    return ok({ qrCode: await getMerchantService().updateQrCodeStatus(identity, qrCodeId, body.isActive) });
  } catch (error) {
    return handleRouteError(error);
  }
}
