export const dynamic = "force-dynamic";

import Link from "next/link";
import LogoutButton from "@/components/merchant/LogoutButton";
import { requireMerchantIdentity } from "@/server/auth/merchant-session";
import { getBillingService } from "@/server/bootstrap/billing-container";
import styles from "./billing.module.css";

function inr(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export default async function BillingPage() {
  const identity = await requireMerchantIdentity();
  const billing = getBillingService();
  const [subscription, plans] = await Promise.all([
    billing.getSnapshot(identity.organizationId),
    billing.listPlans(),
  ]);

  const isTrial = subscription.status === "trialing";
  const homeHref = identity.onboardingCompletedAt ? "/dashboard" : "/onboarding";

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <Link href={homeHref} className={styles.brand}>
          <span className={styles.brandMark}>QR</span>
          <span><strong>QR Review</strong><span>{identity.organizationName}</span></span>
        </Link>
        <div className={styles.topActions}>
          <Link className={styles.backLink} href={homeHref}>← Back to workspace</Link>
          <LogoutButton />
        </div>
      </header>

      <div className={styles.content}>
        <div className={styles.heading}>
          <div>
            <span className={styles.eyebrow}>PLAN &amp; BILLING</span>
            <h1>Workspace status</h1>
            <p>Your workspace is active with unlimited locations and QR codes. No payment or billing required.</p>
          </div>
        </div>

        <section className={styles.statusCard}>
          <div>
            <span className={styles.eyebrow}>STATUS</span>
            <h2>Active Unlimited Access</h2>
            <p>
              Your system is ready to collect unlimited Google reviews. All locations and QR codes remain fully functional.
            </p>
          </div>
          <div className={styles.statusActions}>
            <Link href="/dashboard" className={styles.statusBadge}>
              Go to Dashboard →
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
