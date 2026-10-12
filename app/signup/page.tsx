import { redirect } from "next/navigation";
import Link from "next/link";
import UiIcon from "@/components/UiIcon";
import SignupForm from "@/components/merchant/SignupForm";
import { getOptionalMerchantIdentity } from "@/server/auth/merchant-session";

export default async function SignupPage() {
  const identity = await getOptionalMerchantIdentity();
  if (identity) redirect(identity.onboardingCompletedAt ? "/dashboard" : "/onboarding");

  return (
    <main className="merchantLogin">
      <section className="merchantLoginVisual">
        <Link className="merchantLogo" href="/"><span className="merchantLogoMark"><UiIcon name="qr" /></span> QR Review</Link>
        <div>
          <span className="merchantEyebrow">7-DAY FREE TRIAL</span>
          <h1>Your next chapter.<br /><em>Starts with a scan.</em></h1>
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
          <Link href="/" className="authBrand"><UiIcon name="qr" /> QR Review</Link>
          <span className="merchantEyebrow">START FREE</span>
          <h2>Make room for growth.</h2>
          <p>Set up the owner account now. Business details can be refined during onboarding.</p>
          <SignupForm />
        </div>
      </section>
    </main>
  );
}
