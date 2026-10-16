import { authedRoute, json } from "@/server/http/handler";
import { verifyChain } from "@/server/services/audit.service";

export const POST = authedRoute(async ({ actor, meta }) => json(await verifyChain(actor, meta)));
