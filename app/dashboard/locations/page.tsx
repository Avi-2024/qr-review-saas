import LocationManager from "@/components/merchant/LocationManager";
import { requireMerchantIdentity } from "@/server/auth/merchant-session";
import { isGooglePlacesConfigured } from "@/server/bootstrap/google-places-container";
import { getMerchantService } from "@/server/bootstrap/merchant-container";

export default async function LocationsPage() {
  const identity = await requireMerchantIdentity();
  const locations = await getMerchantService().listLocations(identity);

  return (
    <>
      <header className="merchantTopbar">
        <div><span className="merchantEyebrow">LOCATION MANAGEMENT</span><h1>Your business locations</h1><p>Connect each offline location to its Google review destination and control availability centrally.</p></div>
        <span className="merchantPill">{identity.organizationName}</span>
      </header>
      <LocationManager locations={locations} role={identity.role} placesSearchEnabled={isGooglePlacesConfigured()} />
    </>
  );
}
