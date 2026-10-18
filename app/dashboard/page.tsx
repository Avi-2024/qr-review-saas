import Link from "next/link";
import { activityPercentage, funnelLabel } from "@/lib/merchant-display";
import { requireMerchantIdentity } from "@/server/auth/merchant-session";
import { getMerchantService } from "@/server/bootstrap/merchant-container";

export default async function DashboardPage() {
  const identity = await requireMerchantIdentity();
  const data = await getMerchantService().dashboard(identity, 30);
  const maxTrend = Math.max(1, ...data.trend.flatMap((d) => [d.scans, d.generated, d.googleOpens]));
  const maxFunnel = Math.max(1, ...data.funnel.map((item) => item.value));

  return (
    <>
      <header className="merchantTopbar">
        <div><span className="merchantEyebrow">OVERVIEW · LAST 30 DAYS</span><h1>Reputation overview</h1><p>See where customer intent turns into review activity across your locations.</p></div>
        <span className="merchantPill">{identity.organizationName} · {identity.role}</span>
      </header>

      <section className="merchantKpis">
        <article className="merchantCard merchantKpi"><div className="merchantKpiLabel"><span>Card / QR opens</span><span>↗</span></div><strong>{data.summary.scans.toLocaleString()}</strong><small>Unique review sessions started</small></article>
        <article className="merchantCard merchantKpi"><div className="merchantKpiLabel"><span>Reviews generated</span><span>✦</span></div><strong>{data.summary.reviewsGenerated.toLocaleString()}</strong><small>Customers reaching a review draft</small></article>
        <article className="merchantCard merchantKpi"><div className="merchantKpiLabel"><span>Google opens</span><span>G</span></div><strong>{data.summary.googleOpens.toLocaleString()}</strong><small>Review composer handoffs</small></article>
        <article className="merchantCard merchantKpi"><div className="merchantKpiLabel"><span>Open → Google</span><span>%</span></div><strong>{data.summary.conversionRate}%</strong><small>Measured handoff conversion</small></article>
      </section>

      <section className="merchantGrid2">
        <article className="merchantCard merchantSectionCard">
          <div className="merchantSectionHead"><div><span className="merchantEyebrow">ACTIVITY TREND</span><h2>Customer review momentum</h2><p>Daily scans, generated drafts and Google review opens.</p></div><Link href="/dashboard/analytics" className="merchantPill">Full analytics</Link></div>
          <div className="merchantTrend" aria-label="30 day activity chart">
            {data.trend.map((point) => (
              <div className="merchantTrendDay" key={point.date} title={`${point.date}: ${point.scans} scans, ${point.generated} generated, ${point.googleOpens} Google opens`}>
                <span className="merchantTrendBar" style={{ height: `${activityPercentage(point.scans, maxTrend)}%` }} />
                <span className="merchantTrendBar generated" style={{ height: `${activityPercentage(point.generated, maxTrend)}%` }} />
                <span className="merchantTrendBar google" style={{ height: `${activityPercentage(point.googleOpens, maxTrend)}%` }} />
              </div>
            ))}
          </div>
          <div className="merchantLegend"><span>Scans</span><span>Generated</span><span>Google opens</span></div>
        </article>

        <article className="merchantCard merchantSectionCard">
          <div className="merchantSectionHead"><div><span className="merchantEyebrow">FUNNEL</span><h2>Customer journey</h2><p>Where customers continue or drop off.</p></div></div>
          <div className="merchantFunnel">
            {data.funnel.map((item) => (
              <div className="merchantFunnelRow" key={item.event}>
                <span>{funnelLabel(item.event)}</span>
                <div className="merchantFunnelTrack"><i style={{ width: `${activityPercentage(item.value, maxFunnel)}%` }} /></div>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="merchantGrid2">
        <article className="merchantCard merchantSectionCard"><div className="merchantSectionHead"><div><span className="merchantEyebrow">FOOTPRINT</span><h2>{data.summary.locations} active location{data.summary.locations === 1 ? "" : "s"}</h2><p>{data.summary.qrCodes} active review touchpoint{data.summary.qrCodes === 1 ? "" : "s"} currently collecting customer activity.</p></div><Link href="/dashboard/locations" className="merchantPill">Manage locations</Link></div></article>
        <article className="merchantCard merchantSectionCard"><div className="merchantSectionHead"><div><span className="merchantEyebrow">NEXT ACTION</span><h2>Place NFC cards where intent is highest</h2><p>Program a unique card link per counter or desk. Customers can tap their phones or scan the QR backup to open the same review flow.</p></div><Link href="/dashboard/qr-codes" className="merchantPill">Manage NFC cards</Link></div></article>
      </section>
    </>
  );
}
