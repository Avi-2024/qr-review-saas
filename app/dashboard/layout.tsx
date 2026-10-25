import { redirect } from "next/navigation";
import LogoutButton from "@/components/merchant/LogoutButton";
import MerchantNav from "@/components/merchant/MerchantNav";
import UiIcon from "@/components/UiIcon";
import { requireMerchantIdentity } from "@/server/auth/merchant-session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const identity = await requireMerchantIdentity();
  if (!identity.onboardingCompletedAt) redirect("/onboarding");

  return (
    <div className="merchantApp merchantShell">
      <aside className="merchantSidebar">
        <div className="merchantSidebarHead">
          <span className="merchantLogoMark"><UiIcon name="qr" /></span>
          <div><strong>QR Review</strong><span>Super Admin</span></div>
        </div>
        <div className="merchantNavLabel">SUPER ADMIN WORKSPACE</div>
        <MerchantNav />
        <div className="merchantSidebarFoot">
          <div className="merchantAccount"><strong>{identity.name}</strong><span>{identity.email} · Super Admin</span></div>
          <LogoutButton />
        </div>
      </aside>
      <section className="merchantMain">
        {children}
      </section>
      <MerchantNav mobile />
    </div>
  );
}
