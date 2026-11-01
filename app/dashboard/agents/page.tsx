export const dynamic = "force-dynamic";

import AgentManager from "@/components/merchant/AgentManager";
import { requireMerchantIdentity } from "@/server/auth/merchant-session";
import { getMerchantService } from "@/server/bootstrap/merchant-container";

export default async function AgentsPage() {
  const identity = await requireMerchantIdentity();
  const agents = await getMerchantService().listAgents(identity);

  return (
    <>
      <header className="merchantTopbar">
        <div>
          <span className="merchantEyebrow">SUPER ADMIN WORKSPACE</span>
          <h1>Field Sales &amp; Agents</h1>
          <p>
            Manage field agents who visit client shops, deploy printed QR standees, and onboard merchants on the ground.
          </p>
        </div>
        <span className="merchantPill">{agents.length} Agents Registered</span>
      </header>

      <AgentManager initialAgents={agents} role={identity.role} />
    </>
  );
}
