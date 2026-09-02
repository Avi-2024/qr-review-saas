import Link from "next/link";
import { requireMerchantIdentity } from "@/server/auth/merchant-session";
import { getMerchantService } from "@/server/bootstrap/merchant-container";

function pct(value: number, max: number) { return Math.max(2, max ? Math.round((value / max) * 100) : 2); }

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const identity = await requireMerchantIdentity();
  const params = await searchParams;
  const requestedDays = Number(params.days || 30);
  const data = await getMerchantService().dashboard(identity, requestedDays);
  const maxTrend = Math.max(1, ...data.trend.flatMap((d)=>[d.scans,d.generated,d.googleOpens]));
  const maxFunnel = Math.max(1, ...data.funnel.map((item)=>item.value));
  const generationRate = data.summary.scans ? Math.round((data.summary.reviewsGenerated / data.summary.scans) * 1000) / 10 : 0;
  const googleFromGenerated = data.summary.reviewsGenerated ? Math.round((data.summary.googleOpens / data.summary.reviewsGenerated) * 1000) / 10 : 0;

  return (
    <>
      <header className="merchantTopbar">
        <div><span className="merchantEyebrow">ANALYTICS</span><h1>Review funnel intelligence</h1><p>Measure customer progression without pretending a Google review was posted when we can only verify the handoff.</p></div>
        <div className="merchantActions">{[7,30,90].map((days)=><Link key={days} href={`/dashboard/analytics?days=${days}`} className="merchantPill">{days}d</Link>)}</div>
      </header>

      <section className="merchantCard merchantAnalyticsHero">
        <div><span className="merchantEyebrow">SCAN → GOOGLE REVIEW COMPOSER</span><h2>{data.summary.conversionRate}% measured conversion</h2><p>Google opens are measured when the customer is handed off to Google’s review composer. We intentionally do not label this as a posted review because Google does not provide that confirmation to this flow.</p></div>
        <div className="merchantConversion" style={{ "--conversion": `${Math.min(100,data.summary.conversionRate)}%` } as React.CSSProperties}><strong>{data.summary.conversionRate}%</strong><span>conversion</span></div>
      </section>

      <section className="merchantKpis">
        <article className="merchantCard merchantKpi"><div className="merchantKpiLabel"><span>Scans</span><span>QR</span></div><strong>{data.summary.scans}</strong><small>Unique sessions in {data.days} days</small></article>
        <article className="merchantCard merchantKpi"><div className="merchantKpiLabel"><span>Generation rate</span><span>✦</span></div><strong>{generationRate}%</strong><small>Scans reaching a generated draft</small></article>
        <article className="merchantCard merchantKpi"><div className="merchantKpiLabel"><span>Draft → Google</span><span>G</span></div><strong>{googleFromGenerated}%</strong><small>Generated customers opening Google</small></article>
        <article className="merchantCard merchantKpi"><div className="merchantKpiLabel"><span>Active QR assets</span><span>⌁</span></div><strong>{data.summary.qrCodes}</strong><small>Across {data.summary.locations} location{data.summary.locations===1?"":"s"}</small></article>
      </section>

      <section className="merchantGrid2">
        <article className="merchantCard merchantSectionCard">
          <div className="merchantSectionHead"><div><span className="merchantEyebrow">DAILY TREND · {data.days} DAYS</span><h2>Review activity over time</h2><p>Hover a bar group to inspect each day.</p></div></div>
          <div className="merchantTrend">{data.trend.map((point)=><div className="merchantTrendDay" key={point.date} title={`${point.date}: ${point.scans} scans · ${point.generated} generated · ${point.googleOpens} Google opens`}><span className="merchantTrendBar" style={{height:`${pct(point.scans,maxTrend)}%`}}/><span className="merchantTrendBar generated" style={{height:`${pct(point.generated,maxTrend)}%`}}/><span className="merchantTrendBar google" style={{height:`${pct(point.googleOpens,maxTrend)}%`}}/></div>)}</div>
          <div className="merchantLegend"><span>Scans</span><span>Generated</span><span>Google opens</span></div>
        </article>
        <article className="merchantCard merchantSectionCard">
          <div className="merchantSectionHead"><div><span className="merchantEyebrow">CONVERSION FUNNEL</span><h2>Customer progression</h2><p>Distinct sessions reaching each measurable milestone.</p></div></div>
          <div className="merchantFunnel">{data.funnel.map((item)=><div className="merchantFunnelRow" key={item.event}><span>{item.event.replaceAll("_"," ")}</span><div className="merchantFunnelTrack"><i style={{width:`${pct(item.value,maxFunnel)}%`}}/></div><strong>{item.value}</strong></div>)}</div>
        </article>
      </section>
    </>
  );
}
