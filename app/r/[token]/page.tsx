export const dynamic = "force-dynamic";

import ReviewExperience from "@/components/ReviewExperience";
import StandeeActivationScreen from "@/components/merchant/StandeeActivationScreen";
import { getOptionalMerchantIdentity } from "@/server/auth/merchant-session";
import { getMerchantService } from "@/server/bootstrap/merchant-container";
import { getEnv } from "@/server/config/env";

export default async function QrReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Check if token corresponds to an unassigned pre-printed standee
  try {
    const standee = await getMerchantService().getStandeeByToken(token);
    if (standee && standee.status === "unassigned") {
      const identity = await getOptionalMerchantIdentity();
      const locations = identity ? await getMerchantService().listLocations(identity) : [];
      const placesSearchEnabled = Boolean(getEnv().GOOGLE_PLACES_API_KEY);

      return (
        <StandeeActivationScreen
          standee={standee}
          identity={identity}
          locations={locations}
          placesSearchEnabled={placesSearchEnabled}
        />
      );
    }
  } catch {
    // If lookup fails, continue to normal review experience
  }

  return <ReviewExperience key={token} qrToken={token} />;
}
