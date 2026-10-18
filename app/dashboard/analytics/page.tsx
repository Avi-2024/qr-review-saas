import Link from "next/link";
import { activityPercentage, funnelLabel } from "@/lib/merchant-display";
import { requireMerchantIdentity } from "@/server/auth/merchant-session";
import { getMerchantService } from "@/server/bootstrap/merchant-container";
import { getQrPerformanceService } from "@/server/bootstrap/qr-performance-container";

function metric(value: number) { return Number.isFinite(value) ? `${value}%` : "0%"; }

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string; location?: string }> }) {
  const identity = await requireMerchantIdentity();
  const params = await searchParams;
  const requestedDays = Number(params.days || 30);
  const merchantService = getMerchantService();
  const [data, locations, qrPerformance] = await Promise.all([
    merchantService.dashboard(identity, requestedDays),
    merchantService.listLocations(identity),
    getQrPerformanceService().getAnalytics(identity, { days: requestedDays, locationId: params.location }),
  ]);
  const maxTrend = Math.max(1, ...data.trend.flatMap((d)=>[d.scans,d.generated,d.googleOpens]));
  const maxFunnel = Math.max(1, ...data.funnel.map((item)=>item.value));
  const generationRate = data.summary.scans ? Math.round((data.summary.reviewsGenerated / data.summary.scans) * 1000) / 10 : 0;
  const googleFromGenerated = data.summary.reviewsGenerated ? Math.round((data.summary.googleOpens / data.summary.reviewsGenerated) * 1000) / 10 : 0;
  const selectedLocation = qrPerformance.locationId ? locations.find((location)=>location.id===qrPerformance.locationId) ?? null : null;

  return (
    <>
      <header className="merchantTopbar">
        <div><span className="merchantEyebrow">ANALYTICS</span><h1>Review funnel intelligence</h1><p>Measure customer progression and compare NFC card and QR backup touchpoints without claiming a Google review was posted.</p></div>
        <div className="merchantActions">{[7,30,90].map((days)=>{
          const suffix = qrPerformance.locationId ? `&location=${encodeURIComponent(qrPerformance.locationId)}` : "";
          return <Link key={days} href={`/dashboard/analytics?days=${days}${suffix}`} className="merchantPill">{days}d</Link>;
        })}</div>
      </header>

      <section className="merchantCard merchantAnalyticsHero">
        <div><span className="merchantEyebrow">ENTRY → GOOGLE REVIEW COMPOSER</span><h2>{data.summary.conversionRate}% measured conversion</h2><p>Google opens are measured when the customer is handed off to Google’s review composer. We intentionally do not label this as a posted review because Google does not provide that confirmation to this flow.</p></div>
        <div className="merchantConversion" style={{ "--conversion": `${Math.min(100,data.summary.conversionRate)}%` } as React.CSSProperties}><strong>{data.summary.conversionRate}%</strong><span>conversion</span></div>
      </section>

      <section className="merchantKpis">
        <article className="merchantCard merchantKpi"><div className="merchantKpiLabel"><span>Entries</span><span>NFC / QR</span></div><strong>{data.summary.scans}</strong><small>Unique sessions in {data.days} days</small></article>
        <article className="merchantCard merchantKpi"><div className="merchantKpiLabel"><span>Generation rate</span><span>✦</span></div><strong>{generationRate}%</strong><small>Scans reaching a generated draft</small></article>
        <article className="merchantCard merchantKpi"><div className="merchantKpiLabel"><span>Draft → Google</span><span>G</span></div><strong>{googleFromGenerated}%</strong><small>Generated customers opening Google</small></article>
        <article className="merchantCard merchantKpi"><div className="merchantKpiLabel"><span>Active touchpoints</span><span>⌁</span></div><strong>{data.summary.qrCodes}</strong><small>Across {data.summary.locations} location{data.summary.locations===1?"":"s"}</small></article>
      </section>

      <section className="merchantGrid2">
        <article className="merchantCard merchantSectionCard">
          <div className="merchantSectionHead"><div><span className="merchantEyebrow">DAILY TREND · {data.days} DAYS</span><h2>Review activity over time</h2><p>Hover a bar group to inspect each day.</p></div></div>
          <div className="merchantTrend">{data.trend.map((point)=><div className="merchantTrendDay" key={point.date} title={`${point.date}: ${point.scans} scans · ${point.generated} generated · ${point.googleOpens} Google opens`}><span className="merchantTrendBar" style={{height:`${activityPercentage(point.scans,maxTrend)}%`}}/><span className="merchantTrendBar generated" style={{height:`${activityPercentage(point.generated,maxTrend)}%`}}/><span className="merchantTrendBar google" style={{height:`${activityPercentage(point.googleOpens,maxTrend)}%`}}/></div>)}</div>
          <div className="merchantLegend"><span>Scans</span><span>Generated</span><span>Google opens</span></div>
        </article>
        <article className="merchantCard merchantSectionCard">
          <div className="merchantSectionHead"><div><span className="merchantEyebrow">CONVERSION FUNNEL</span><h2>Customer progression</h2><p>Distinct sessions reaching each measurable milestone.</p></div></div>
          <div className="merchantFunnel">{data.funnel.map((item)=><div className="merchantFunnelRow" key={item.event}><span>{item.event.replaceAll("_"," ")}</span><div className="merchantFunnelTrack"><i style={{width:`${activityPercentage(item.value,maxFunnel)}%`}}/></div><strong>{item.value}</strong></div>)}</div>
        </article>
      </section>

      <section className="qrPerformanceSection">
        <div className="qrPerformanceHeading">
          <div><span className="merchantEyebrow">TOUCHPOINT PERFORMANCE · {qrPerformance.days} DAYS</span><h2>Which card placements actually work?</h2><p>Compare NFC/QR entry sessions through Google handoff. Both links for the same token share one touchpoint count; the current system does not independently distinguish NFC taps from backup QR scans. Paused assets retain historical performance.</p></div>
          <form className="qrPerformanceFilter" action="/dashboard/analytics" method="get">
            <input type="hidden" name="days" value={qrPerformance.days} />
            <label htmlFor="qr-location-filter">Touchpoint location</label>
            <div><select id="qr-location-filter" name="location" defaultValue={qrPerformance.locationId ?? ""}><option value="">All locations</option>{locations.map((location)=><option key={location.id} value={location.id}>{location.name}{location.isActive?"":" · Paused"}</option>)}</select><button className="merchantBtn secondary" type="submit">Apply</button></div>
          </form>
        </div>

        <div className="qrPerformanceKpis">
          <article className="merchantCard qrPerformanceKpi"><span>Most opened</span><strong>{qrPerformance.mostScanned?.qrName ?? "—"}</strong><small>{qrPerformance.mostScanned ? `${qrPerformance.mostScanned.scans} scans · ${qrPerformance.mostScanned.locationName}` : "No QR activity yet"}</small></article>
          <article className="merchantCard qrPerformanceKpi"><span>Best converter</span><strong>{qrPerformance.bestConverter?.qrName ?? "—"}</strong><small>{qrPerformance.bestConverter ? `${metric(qrPerformance.bestConverter.conversionRate)} Scan → Google · ${qrPerformance.bestConverter.scans} scans` : `Needs at least ${qrPerformance.minimumConversionSample} scans per QR`}</small></article>
          <article className="merchantCard qrPerformanceKpi"><span>Zero activity</span><strong>{qrPerformance.zeroActivityCount}</strong><small>{selectedLocation ? `Touchpoints in ${selectedLocation.name}` : "Touchpoints with no entries in this period"}</small></article>
          <article className="merchantCard qrPerformanceKpi"><span>Touchpoint attribution</span><strong>{qrPerformance.attribution.scans ? `${qrPerformance.attribution.attributionRate}%` : "—"}</strong><small>{qrPerformance.attribution.unattributedScans ? `${qrPerformance.attribution.unattributedScans} legacy/unattributed entries` : "All measured entries mapped to a touchpoint"}</small></article>
        </div>

        {qrPerformance.attribution.unattributedScans > 0 ? <div className="qrAttributionNotice">Some older sessions were created before touchpoint-level attribution was available. They remain in organization totals but are intentionally not assigned to a specific QR.</div> : null}

        <div className="merchantCard qrPerformanceTableCard">
          <div className="qrPerformanceTableHead"><div><span className="merchantEyebrow">RANKED BY ENTRIES</span><h3>{selectedLocation ? selectedLocation.name : "All review touchpoints"}</h3></div><span>{qrPerformance.rows.length} QR asset{qrPerformance.rows.length===1?"":"s"}</span></div>
          {qrPerformance.rows.length ? (
            <div className="qrPerformanceTableScroll"><table className="qrPerformanceTable"><thead><tr><th>Review touchpoint</th><th>Status</th><th>Entries</th><th>Generated</th><th>Google opens</th><th>Entry → Google</th><th>Draft → Google</th></tr></thead><tbody>{qrPerformance.rows.map((row)=><tr key={row.qrCodeId}><td><strong>{row.qrName}</strong><small>{row.locationName} · {row.sourceType}{row.reference ? ` · ${row.reference}` : ""}</small></td><td><span className={`merchantStatus${row.isActive?"":" off"}`}>{row.isActive?"Active":"Paused"}</span></td><td><strong>{row.scans}</strong></td><td><strong>{row.reviewsGenerated}</strong><small>{metric(row.generationRate)}</small></td><td><strong>{row.googleOpens}</strong></td><td><div className="qrRateCell"><div><i style={{width:`${Math.min(100,row.conversionRate)}%`}}/></div><strong>{metric(row.conversionRate)}</strong></div></td><td><strong>{metric(row.googleFromGeneratedRate)}</strong></td></tr>)}</tbody></table></div>
          ) : <div className="merchantEmpty">No review touchpoints match this location yet.</div>}
        </div>
      </section>
    </>
  );
}
