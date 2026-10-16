import { authedRoute, json } from "@/server/http/handler";
import { getMyProfile } from "@/server/services/health.service";

export const GET = authedRoute(async ({ actor }) => json(await getMyProfile(actor)));
