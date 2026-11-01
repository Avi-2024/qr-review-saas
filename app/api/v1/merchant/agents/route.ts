import { z } from "zod";
import { requireMerchantApiIdentity } from "@/server/auth/merchant-session";
import { getMerchantService } from "@/server/bootstrap/merchant-container";
import { handleRouteError, created, ok } from "@/server/http/response";

export const runtime = "nodejs";

const createAgentSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  email: z.string().trim().email("Please provide a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
});

export async function GET() {
  try {
    const { identity } = await requireMerchantApiIdentity();
    const agents = await getMerchantService().listAgents(identity);
    return ok({ agents });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { identity } = await requireMerchantApiIdentity();
    const body = createAgentSchema.parse(await request.json());
    const agent = await getMerchantService().createAgent(identity, body);
    return created({ agent });
  } catch (error) {
    return handleRouteError(error);
  }
}
