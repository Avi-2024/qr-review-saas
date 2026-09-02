import { redirect } from "next/navigation";
import LoginForm from "@/components/merchant/LoginForm";
import { getOptionalMerchantIdentity } from "@/server/auth/merchant-session";

export default async function LoginPage() {
  const identity = await getOptionalMerchantIdentity();
  if (identity) redirect(identity.onboardingCompletedAt ? "/dashboard" : "/onboarding");

  return (
    <main className="merchantLogin">
      <section className="merchantLoginVisual">
        <div className="merchantLogo"><span className="merchantLogoMark">QR</span> REVIEW INTELLIGENCE</div>
        <div>
          <span className="merchantEyebrow">MERCHANT OPERATING SYSTEM</span>
          <h1>Turn every customer moment into measurable reputation growth.</h1>
          <p>Manage locations, QR touchpoints and the full review funnel from one focused workspace — without compromising authentic customer sentiment.</p>
        </div>
        <div className="merchantLoginPoints">
          <div className="merchantLoginPoint"><strong>One view</strong><span>Locations, QR assets and review activity together.</span></div>
          <div className="merchantLoginPoint"><strong>Real funnel</strong><span>Track scans through Google review handoff.</span></div>
          <div className="merchantLoginPoint"><strong>Tenant safe</strong><span>Every merchant query is organization scoped.</span></div>
        </div>
      </section>
      <section className="merchantLoginPanel">
        <div className="merchantLoginCard">
          <span className="merchantEyebrow">WELCOME BACK</span>
          <h2>Merchant sign in</h2>
          <p>Use your merchant owner or team account to access the reputation workspace.</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
