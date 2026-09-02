import QrManager from "@/components/merchant/QrManager";
import { requireMerchantIdentity } from "@/server/auth/merchant-session";
import { getMerchantService } from "@/server/bootstrap/merchant-container";

export default async function QrCodesPage() {
  const identity = await requireMerchantIdentity();
  const [qrCodes, locations] = await Promise.all([
    getMerchantService().listQrCodes(identity),
    getMerchantService().listLocations(identity),
  ]);

  return (
    <>
      <header className="merchantTopbar">
        <div><span className="merchantEyebrow">QR MANAGEMENT</span><h1>QR touchpoints</h1><p>Create separate customer entry points for each location and understand which physical placement actually drives review activity.</p></div>
        <span className="merchantPill">{qrCodes.filter((item)=>item.isActive).length} active</span>
      </header>
      <QrManager qrCodes={qrCodes} locations={locations} role={identity.role} />
    </>
  );
}
