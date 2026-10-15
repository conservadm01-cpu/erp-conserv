import { authedRoute, json } from "@/server/http/handler";
import { getDashboard } from "@/server/services/dashboard.service";

export const GET = authedRoute(async ({ actor }) => json(await getDashboard(actor)));
