import { redirect } from "next/navigation";
import SignupForm from "@/components/merchant/SignupForm";
import { getOptionalMerchantIdentity } from "@/server/auth/merchant-session";

export default async function SignupPage() {
  const identity = await getOptionalMerchantIdentity();
  if (identity) redirect(identity.onboardingCompletedAt ? "/dashboard" : "/onboarding");

  return (
    <main className="merchantLogin">
      <section className="merchantLoginVisual">
        <div className="merchantLogo"><span className="merchantLogoMark">QR</span> REVIEW INTELLIGENCE</div>
        <div>
          <span className="merchantEyebrow">7-DAY FREE TRIAL</span>
          <h1>Launch your first review QR in minutes.</h1>
          <p>Start with the full reputation workflow, connect your Google review destination and measure which physical touchpoints convert best.</p>
        </div>
        <div className="merchantLoginPoints">
          <div className="merchantLoginPoint"><strong>No card</strong><span>Try the core workflow before paying.</span></div>
          <div className="merchantLoginPoint"><strong>7 full days</strong><span>Your trial starts when the organization is created.</span></div>
          <div className="merchantLoginPoint"><strong>Keep your data</strong><span>Trial expiry pauses write access; it does not delete your workspace.</span></div>
        </div>
      </section>
      <section className="merchantLoginPanel">
        <div className="merchantLoginCard">
          <span className="merchantEyebrow">START FREE</span>
          <h2>Create your merchant workspace</h2>
          <p>Set up the owner account now. Business details can be refined during onboarding.</p>
          <SignupForm />
        </div>
      </section>
    </main>
  );
}
