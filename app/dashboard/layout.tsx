import Link from "next/link";
import { redirect } from "next/navigation";
import LogoutButton from "@/components/merchant/LogoutButton";
import { requireMerchantIdentity } from "@/server/auth/merchant-session";

const nav = [
  ["/dashboard", "◫", "Overview"],
  ["/dashboard/locations", "⌂", "Locations"],
  ["/dashboard/topics", "≡", "Topics"],
  ["/dashboard/qr-codes", "⌁", "QR Codes"],
  ["/dashboard/analytics", "↗", "Analytics"],
] as const;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const identity = await requireMerchantIdentity();
  if (!identity.onboardingCompletedAt) redirect("/onboarding");

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
          <div className="merchantAccount"><strong>{identity.name}</strong><span>{identity.email} · {identity.role}</span></div>
          <LogoutButton />
        </div>
      </aside>
      <section className="merchantMain">{children}</section>
      <nav className="merchantMobileNav">
        {nav.map(([href, _icon, label]) => <Link key={href} href={href}>{label}</Link>)}
      </nav>
    </div>
  );
}
