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
        <div><span className="merchantEyebrow">NFC &amp; QR MANAGEMENT</span><h1>NFC review cards</h1><p>Create NFC-ready tap links for each location, program them onto physical cards, and keep QR codes as a fallback. Track each card's review journey.</p></div>
        <span className="merchantPill">{qrCodes.filter((item)=>item.isActive).length} active</span>
      </header>
      <QrManager qrCodes={qrCodes} locations={locations} role={identity.role} />
    </>
  );
}
