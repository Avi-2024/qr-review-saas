import QRCode from "qrcode";
import { NotFoundError } from "@/server/core/errors";
import { requireMerchantApiIdentity } from "@/server/auth/merchant-session";
import { getMerchantService } from "@/server/bootstrap/merchant-container";
import { handleRouteError } from "@/server/http/response";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ qrCodeId: string }> },
) {
  try {
    const { identity } = await requireMerchantApiIdentity();
    const { qrCodeId } = await context.params;
    const qrCodes = await getMerchantService().listQrCodes(identity);
    const qr = qrCodes.find((item) => item.id === qrCodeId);
    if (!qr) throw new NotFoundError("QR code not found.", "QR_CODE_NOT_FOUND");

    const origin = new URL(request.url).origin;
    const destination = `${origin}/r/${encodeURIComponent(qr.publicToken)}`;
    const svg = await QRCode.toString(destination, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 2,
      width: 640,
    });
    const download = new URL(request.url).searchParams.get("download") === "1";

    return new Response(svg, {
      status: 200,
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "private, max-age=300",
        "content-disposition": `${download ? "attachment" : "inline"}; filename="${qr.publicToken}.svg"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
