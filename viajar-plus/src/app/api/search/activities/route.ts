import { activityParamsSchema } from "@/lib/providers/types";
import { activityProviders } from "@/lib/providers/registry";
import { activityLinks } from "@/lib/providers/links";
import { runProviders } from "@/lib/providers/search-response";
import { readParams } from "@/lib/server/provider-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const p = await readParams(req, activityParamsSchema, "search:activities", 20);
  if (!p.ok) return p.res;
  const providers = activityProviders();
  const body = await runProviders(providers, (i) => providers[i].searchActivities(p.data), activityLinks(p.data.destination, p.data.date));
  return Response.json(body);
}
