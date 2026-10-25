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
        <Link className="merchantLogo" href="/">
          <span className="merchantLogoMark"><UiIcon name="qr" /></span> QR Review
        </Link>
        <div>
          <span className="merchantEyebrow">ADMINISTRATION CONTROL PANEL</span>
          <h1>Centralized control.<br /><em>Every merchant review in one place.</em></h1>
          <p>
            Administer client businesses, connect their Google review destinations, customize feedback topics, and generate high-converting QR touchpoints.
          </p>
        </div>
        <div className="merchantLoginPoints">
          <div className="merchantLoginPoint">
            <strong>Register Merchants</strong>
            <span>Add client businesses directly and bind their Google Places ID.</span>
          </div>
          <div className="merchantLoginPoint">
            <strong>QR &amp; NFC Assets</strong>
            <span>Generate, customize, and print QR codes for counters and tables.</span>
          </div>
          <div className="merchantLoginPoint">
            <strong>Centralized Analytics</strong>
            <span>Track customer review conversion across all client locations.</span>
          </div>
        </div>
      </section>
      <section className="merchantLoginPanel">
        <div className="merchantLoginCard">
          <Link href="/" className="authBrand"><UiIcon name="qr" /> QR Review</Link>
          <span className="merchantEyebrow">SUPER ADMIN PORTAL</span>
          <h2>Admin Sign In</h2>
          <p>Sign in with your master administrator credentials.</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
