import { redirect } from "next/navigation";
import OnboardingWizard from "@/components/merchant/OnboardingWizard";
import { requireMerchantIdentity } from "@/server/auth/merchant-session";
import { getMerchantService } from "@/server/bootstrap/merchant-container";

export default async function OnboardingPage() {
  const identity = await requireMerchantIdentity();
  if (identity.onboardingCompletedAt) redirect("/dashboard");

  const state = await getMerchantService().onboardingState(identity);
  const initialState = {
    organization: {
      ...state.organization,
      onboardingCompletedAt: state.organization.onboardingCompletedAt?.toISOString() ?? null,
    },
    locations: state.locations.map((location) => ({
      ...location,
      createdAt: location.createdAt.toISOString(),
    })),
    topics: state.topics,
    qrCodes: state.qrCodes.map((qrCode) => ({
      ...qrCode,
      createdAt: qrCode.createdAt.toISOString(),
    })),
  };

  return <OnboardingWizard initialState={initialState} merchantName={identity.name} />;
}
