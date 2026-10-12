import Link from "next/link";
import { redirect } from "next/navigation";
import LogoutButton from "@/components/merchant/LogoutButton";
import MerchantNav from "@/components/merchant/MerchantNav";
import UiIcon from "@/components/UiIcon";
import { requireMerchantIdentity } from "@/server/auth/merchant-session";
import { getBillingService } from "@/server/bootstrap/billing-container";
import styles from "./subscription.module.css";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const identity = await requireMerchantIdentity();
  if (!identity.onboardingCompletedAt) redirect("/onboarding");
  const billing = await getBillingService().getSnapshot(identity.organizationId);

  return (
    <div className="merchantApp merchantShell">
      <aside className="merchantSidebar">
        <div className="merchantSidebarHead">
          <span className="merchantLogoMark"><UiIcon name="qr" /></span>
          <div><strong>QR Review</strong><span>{identity.organizationName}</span></div>
        </div>
        <div className="merchantNavLabel">WORKSPACE</div>
        <MerchantNav />
        <div className="merchantSidebarFoot">
          <Link href="/billing" className={`${styles.trialBadge} ${billing.needsUpgrade ? styles.expired : ""}`}>
            <strong>{billing.status === "trialing" ? `${billing.daysRemaining}d trial left` : billing.plan.name}</strong>
            <span>{billing.needsUpgrade ? "Upgrade required" : "Plan & billing"}</span>
          </Link>
          <div className="merchantAccount"><strong>{identity.name}</strong><span>{identity.email} · {identity.role}</span></div>
          <LogoutButton />
        </div>
      </aside>
      <section className="merchantMain">
        {billing.status === "trialing" && billing.daysRemaining <= 2 ? (
          <div className={styles.banner}>
            <div><strong>Your free trial ends soon.</strong><span>{billing.daysRemaining} day{billing.daysRemaining === 1 ? "" : "s"} remaining. Your data stays safe if the trial expires.</span></div>
            <Link href="/billing">View plans</Link>
          </div>
        ) : null}
        {billing.needsUpgrade ? (
          <div className={`${styles.banner} ${styles.expired}`}>
            <div><strong>Your workspace is read-only.</strong><span>Activate a subscription to create or change locations, topics and QR codes and to accept new review sessions.</span></div>
            <Link href="/billing">Choose a plan</Link>
          </div>
        ) : null}
        {children}
      </section>
      <MerchantNav mobile />
    </div>
  );
}
