import { requireMerchantIdentity } from "@/server/auth/merchant-session";
import { getBillingService } from "@/server/bootstrap/billing-container";

function inr(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

function usageLabel(current: number, max: number) {
  return `${current} / ${max}`;
}

export default async function BillingPage() {
  const identity = await requireMerchantIdentity();
  const billing = getBillingService();
  const [subscription, plans] = await Promise.all([
    billing.getSnapshot(identity.organizationId),
    billing.listPlans(),
  ]);

  const isTrial = subscription.status === "trialing";
  const accessLabel = subscription.canWrite ? "Full access" : "Read-only";

  return (
    <>
      <header className="merchantTopbar">
        <div>
          <span className="merchantEyebrow">BILLING</span>
          <h1>Plan & subscription</h1>
          <p>Manage your trial, plan limits and subscription state without losing historical review data.</p>
        </div>
      </header>

      <section className={`merchantCard billingStatusCard ${subscription.needsUpgrade ? "billingExpired" : ""}`}>
        <div>
          <span className="merchantEyebrow">{isTrial ? "FREE TRIAL" : subscription.status.toUpperCase()}</span>
          <h2>{isTrial ? `${subscription.daysRemaining} day${subscription.daysRemaining === 1 ? "" : "s"} left in your trial` : subscription.plan.name}</h2>
          <p>
            {isTrial
              ? `Your trial ends ${subscription.trialEndsAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}. No card is required during the trial.`
              : subscription.needsUpgrade
                ? "Your workspace data is preserved, but write access and new review collection are paused until a subscription is active."
                : "Your subscription is active and your review workflow remains available."}
          </p>
        </div>
        <div className="billingStatusMeta">
          <span>Workspace access</span><strong>{accessLabel}</strong>
          <span>Current plan</span><strong>{subscription.plan.name}</strong>
        </div>
      </section>

      <section className="merchantGrid2 billingUsageGrid">
        <article className="merchantCard">
          <span className="merchantEyebrow">LOCATION USAGE</span>
          <h3>{usageLabel(subscription.usage.locations, subscription.plan.maxLocations)}</h3>
          <p>Locations included in the {subscription.plan.name} plan.</p>
        </article>
        <article className="merchantCard">
          <span className="merchantEyebrow">QR USAGE</span>
          <h3>{usageLabel(subscription.usage.qrCodes, subscription.plan.maxQrCodes)}</h3>
          <p>QR touchpoints included in the {subscription.plan.name} plan.</p>
        </article>
      </section>

      <section className="billingPlanSection">
        <div className="merchantSectionHeading">
          <div><span className="merchantEyebrow">PLANS</span><h2>Choose the capacity that fits your business</h2></div>
          <p>Checkout integration is the next billing layer; the subscription core and trial enforcement are already provider-agnostic.</p>
        </div>
        <div className="billingPlanGrid">
          {plans.map((plan) => (
            <article className={`merchantCard billingPlanCard ${plan.code === subscription.plan.code ? "selected" : ""}`} key={plan.code}>
              <div>
                <span className="merchantEyebrow">{plan.code === subscription.plan.code ? "CURRENT PLAN" : "PLAN"}</span>
                <h3>{plan.name}</h3>
                <div className="billingPrice"><strong>{inr(plan.monthlyPricePaise)}</strong><span>/ month</span></div>
                <p>{inr(plan.yearlyPricePaise)} billed yearly.</p>
              </div>
              <ul className="billingPlanFeatures">
                <li>{plan.maxLocations} location{plan.maxLocations === 1 ? "" : "s"}</li>
                <li>{plan.maxQrCodes} QR codes</li>
                <li>Review funnel analytics</li>
                <li>Per-QR performance</li>
                <li>Custom review topics</li>
              </ul>
              <button className="merchantBtn" type="button" disabled>
                {plan.code === subscription.plan.code ? "Current plan" : "Checkout coming next"}
              </button>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
