import TopicManager from "@/components/merchant/TopicManager";
import { getBusinessPreset } from "@/lib/business-presets";
import { requireMerchantIdentity } from "@/server/auth/merchant-session";
import { getMerchantService } from "@/server/bootstrap/merchant-container";
import { getMerchantTopicService } from "@/server/bootstrap/merchant-topic-container";

export default async function TopicsPage() {
  const identity = await requireMerchantIdentity();
  const locations = await getMerchantService().listLocations(identity);
  const firstLocation = locations[0] ?? null;
  const topics = firstLocation
    ? await getMerchantTopicService().list(identity, firstLocation.id)
    : [];
  const preset = getBusinessPreset(identity.businessType);

  return (
    <>
      <header className="merchantTopbar">
        <div>
          <span className="merchantEyebrow">REVIEW EXPERIENCE</span>
          <h1>Review topics</h1>
          <p>Control the neutral prompts customers can choose before generating their review.</p>
        </div>
        <span className="merchantPill">{identity.organizationName}</span>
      </header>
      <TopicManager
        locations={locations}
        initialLocationId={firstLocation?.id ?? ""}
        initialTopics={topics}
        suggestedTopics={preset.topics}
        role={identity.role}
      />
    </>
  );
}
