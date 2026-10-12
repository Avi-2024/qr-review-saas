import Link from "next/link";
import { redirect } from "next/navigation";
import LoginForm from "@/components/merchant/LoginForm";
import UiIcon from "@/components/UiIcon";
import { getOptionalMerchantIdentity } from "@/server/auth/merchant-session";

export default async function LoginPage() {
  const identity = await getOptionalMerchantIdentity();
  if (identity) redirect(identity.onboardingCompletedAt ? "/dashboard" : "/onboarding");

  return (
    <main className="merchantLogin">
      <section className="merchantLoginVisual">
        <Link className="merchantLogo" href="/"><span className="merchantLogoMark"><UiIcon name="qr" /></span> QR Review</Link>
        <div>
          <span className="merchantEyebrow">YOUR REPUTATION, IN FOCUS</span>
          <h1>Small moments.<br /><em>Lasting connections.</em></h1>
          <p>A thoughtful workspace for your locations, customer feedback, and the QR touchpoints that bring it all together.</p>
        </div>
        <div className="merchantLoginPoints">
          <div className="merchantLoginPoint"><strong>One view</strong><span>Locations, QR assets and review activity together.</span></div>
          <div className="merchantLoginPoint"><strong>Real funnel</strong><span>Track scans through Google review handoff.</span></div>
          <div className="merchantLoginPoint"><strong>Your workspace</strong><span>A focused view for you and your team.</span></div>
        </div>
      </section>
      <section className="merchantLoginPanel">
        <div className="merchantLoginCard">
          <Link href="/" className="authBrand"><UiIcon name="qr" /> QR Review</Link>
          <span className="merchantEyebrow">WELCOME BACK</span>
          <h2>Welcome back.</h2>
          <p>Sign in to your business workspace.</p>
          <LoginForm />
          <p className="merchantAuthSwitch">New to QR Review? <Link href="/signup">Start a 7-day free trial</Link></p>
        </div>
      </section>
    </main>
  );
}
