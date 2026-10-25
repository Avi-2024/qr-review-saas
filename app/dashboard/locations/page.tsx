export const dynamic = "force-dynamic";

import LocationManager from "@/components/merchant/LocationManager";
import { requireMerchantIdentity } from "@/server/auth/merchant-session";
import { isGooglePlacesConfigured } from "@/server/bootstrap/google-places-container";
import { getMerchantService } from "@/server/bootstrap/merchant-container";

export default async function LocationsPage() {
  const identity = await requireMerchantIdentity();
  const [locations, qrCodes, standees] = await Promise.all([
    getMerchantService().listLocations(identity),
    getMerchantService().listQrCodes(identity),
    getMerchantService().listStandees(identity),
  ]);

  return (
    <>
      <header className="merchantTopbar">
        <div>
          <span className="merchantEyebrow">SUPER ADMIN WORKSPACE</span>
          <h1>Client Merchants</h1>
          <p>Register client businesses, connect their Google Maps review destinations, and deploy pre-printed QR review standees.</p>
        </div>
        <span className="merchantPill">Super Admin</span>
      </header>
      <LocationManager
        locations={locations}
        qrCodes={qrCodes}
        standees={standees}
        role={identity.role}
        placesSearchEnabled={isGooglePlacesConfigured()}
      />
    </>
  );
}
