export const dynamic = "force-dynamic";

import AgentFieldPortal from "@/components/agent/AgentFieldPortal";
import { requireMerchantIdentity } from "@/server/auth/merchant-session";
import { getMerchantService } from "@/server/bootstrap/merchant-container";

export default async function AgentPortalPage() {
  const identity = await requireMerchantIdentity();
  const standees = await getMerchantService().listStandees(identity);

  return (
    <AgentFieldPortal
      identity={identity}
      initialStandees={standees}
    />
  );
}
