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
          {!subscription.needsUpgrade ? <Link className={styles.backLink} href={homeHref}>← Back to workspace</Link> : null}
          <LogoutButton />
        </div>
      </header>

      <div className={styles.content}>
        <div className={styles.heading}>
          <div>
            <span className={styles.eyebrow}>PLAN & BILLING</span>
            <h1>Your subscription</h1>
            <p>Track trial access, workspace limits and plan options. Historical review data is preserved even when a trial or subscription is inactive.</p>
          </div>
        </div>

        <section className={`${styles.statusCard} ${subscription.needsUpgrade ? styles.expired : ""}`}>
          <div>
            <span className={styles.eyebrow}>{isTrial ? "FREE TRIAL" : subscription.status.toUpperCase()}</span>
            <h2>{isTrial ? `${subscription.daysRemaining} day${subscription.daysRemaining === 1 ? "" : "s"} left in your trial` : subscription.plan.name}</h2>
            <p>
              {isTrial
                ? `Your trial ends ${subscription.trialEndsAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}. No card is required during the trial.`
                : subscription.needsUpgrade
                  ? "Your workspace data is preserved, but write access and new review collection are paused until a subscription is active."
                  : "Your subscription is active and your review workflow remains available."}
            </p>
          </div>
          <div className={styles.statusMeta}>
            <span>Workspace access</span><strong>{subscription.canWrite ? "Full access" : "Read-only"}</strong>
            <span>Current plan</span><strong>{subscription.plan.name}</strong>
          </div>
        </section>

        <section className={styles.usageGrid}>
          <article className={styles.usageCard}>
            <span className={styles.eyebrow}>LOCATION USAGE</span>
            <h3>{subscription.usage.locations} / {subscription.plan.maxLocations}</h3>
            <p>Locations included in the {subscription.plan.name} plan.</p>
          </article>
          <article className={styles.usageCard}>
            <span className={styles.eyebrow}>QR USAGE</span>
            <h3>{subscription.usage.qrCodes} / {subscription.plan.maxQrCodes}</h3>
            <p>QR touchpoints included in the {subscription.plan.name} plan.</p>
          </article>
        </section>

        <section className={styles.planSection}>
          <div className={styles.sectionHeading}>
            <div><span className={styles.eyebrow}>PLANS</span><h2>Choose the capacity that fits your business</h2></div>
            <p>Checkout is intentionally separated from the subscription core so Razorpay, Cashfree or another provider can be added without rewriting entitlement logic.</p>
          </div>
          <div className={styles.planGrid}>
            {plans.map((plan) => (
              <article className={`${styles.planCard} ${plan.code === subscription.plan.code ? styles.selected : ""}`} key={plan.code}>
                <div>
                  <span className={styles.eyebrow}>{plan.code === subscription.plan.code ? "CURRENT PLAN" : "PLAN"}</span>
                  <h3>{plan.name}</h3>
                  <div className={styles.price}><strong>{inr(plan.monthlyPricePaise)}</strong><span>/ month</span></div>
                  <p>{inr(plan.yearlyPricePaise)} billed yearly.</p>
                </div>
                <ul className={styles.features}>
                  <li>{plan.maxLocations} location{plan.maxLocations === 1 ? "" : "s"}</li>
                  <li>{plan.maxQrCodes} QR codes</li>
                  <li>Review funnel analytics</li>
                  <li>Per-QR performance analytics</li>
                  <li>Custom review topics</li>
                </ul>
                <button className={styles.planButton} type="button" disabled>
                  {plan.code === subscription.plan.code ? "Current plan" : "Checkout coming next"}
                </button>
              </article>
            ))}
          </div>
          <div className={styles.note}>Payment collection is not enabled in this foundation yet. The next billing step is a provider adapter, verified webhook processing and checkout activation.</div>
        </section>
      </div>
    </main>
  );
}
