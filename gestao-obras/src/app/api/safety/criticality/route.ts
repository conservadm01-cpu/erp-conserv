import { authedRoute, json } from "@/server/http/handler";
import { listCriticality } from "@/server/services/safety.service";

export const GET = authedRoute(async () => json({ levels: await listCriticality() }));
