"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import UiIcon from "@/components/UiIcon";

const nav = [
  ["/dashboard", "grid", "Overview"],
  ["/dashboard/locations", "pin", "Locations"],
  ["/dashboard/topics", "topics", "Topics"],
  ["/dashboard/qr-codes", "qr", "NFC cards"],
  ["/dashboard/analytics", "chart", "Analytics"],
  ["/billing", "billing", "Billing"],
] as const;

export default function MerchantNav({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  return <nav className={mobile ? "merchantMobileNav" : "merchantNav"} aria-label={mobile ? "Mobile workspace navigation" : "Workspace navigation"}>
    {nav.map(([href, icon, label]) => {
      const active = pathname === href;
      return <Link key={href} href={href} aria-current={active ? "page" : undefined}><span className="merchantNavIcon"><UiIcon name={icon} /></span><span>{label}</span>{!mobile && active ? <i className="merchantNavDot" aria-hidden="true" /> : null}</Link>;
    })}
  </nav>;
}
