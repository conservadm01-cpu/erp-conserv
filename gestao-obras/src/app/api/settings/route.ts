import { authedRoute, json } from "@/server/http/handler";
import { listSettings } from "@/server/services/settings.service";

export const GET = authedRoute(async () => json({ settings: await listSettings() }));
