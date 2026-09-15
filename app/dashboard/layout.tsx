import Link from "next/link";
import { redirect } from "next/navigation";
import LogoutButton from "@/components/merchant/LogoutButton";
import { requireMerchantIdentity } from "@/server/auth/merchant-session";
import { getBillingService } from "@/server/bootstrap/billing-container";

const nav = [
  ["/dashboard", "◫", "Overview"],
  ["/dashboard/locations", "⌂", "Locations"],
  ["/dashboard/topics", "≡", "Topics"],
  ["/dashboard/qr-codes", "⌁", "QR Codes"],
  ["/dashboard/analytics", "↗", "Analytics"],
  ["/billing", "₹", "Billing"],
] as const;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const identity = await requireMerchantIdentity();
  if (!identity.onboardingCompletedAt) redirect("/onboarding");
  const billing = await getBillingService().getSnapshot(identity.organizationId);

  return (
    <div className="merchantApp merchantShell">
      <aside className="merchantSidebar">
        <div className="merchantSidebarHead">
          <span className="merchantLogoMark">QR</span>
          <div><strong>QR Review</strong><span>{identity.organizationName}</span></div>
        </div>
        <nav className="merchantNav">
          {nav.map(([href, icon, label]) => (
            <Link key={href} href={href}><span className="merchantNavIcon">{icon}</span>{label}</Link>
          ))}
        </nav>
        <div className="merchantSidebarFoot">
          <Link href="/billing" className={`merchantTrialBadge ${billing.needsUpgrade ? "expired" : ""}`}>
            <strong>{billing.status === "trialing" ? `${billing.daysRemaining}d trial left` : billing.plan.name}</strong>
            <span>{billing.needsUpgrade ? "Upgrade required" : "Plan & billing"}</span>
          </Link>
          <div className="merchantAccount"><strong>{identity.name}</strong><span>{identity.email} · {identity.role}</span></div>
          <LogoutButton />
        </div>
      </aside>
      <section className="merchantMain">
        {billing.status === "trialing" && billing.daysRemaining <= 2 ? (
          <div className="merchantBillingBanner">
            <div><strong>Your free trial ends soon.</strong><span>{billing.daysRemaining} day{billing.daysRemaining === 1 ? "" : "s"} remaining. Your data stays safe if the trial expires.</span></div>
            <Link href="/billing">View plans</Link>
          </div>
        ) : null}
        {billing.needsUpgrade ? (
          <div className="merchantBillingBanner expired">
            <div><strong>Your workspace is read-only.</strong><span>Activate a subscription to create or change locations, topics and QR codes and to accept new review sessions.</span></div>
            <Link href="/billing">Choose a plan</Link>
          </div>
        ) : null}
        {children}
      </section>
      <nav className="merchantMobileNav">
        {nav.map(([href, _icon, label]) => <Link key={href} href={href}>{label}</Link>)}
      </nav>
    </div>
  );
}
