import { flightParamsSchema } from "@/lib/providers/types";
import { flightProviders } from "@/lib/providers/registry";
import { flightLinks } from "@/lib/providers/links";
import { runProviders } from "@/lib/providers/search-response";
import { readParams } from "@/lib/server/provider-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const p = await readParams(req, flightParamsSchema, "search:flights", 12);
  if (!p.ok) return p.res;
  const providers = flightProviders();
  const body = await runProviders(providers, (i) => providers[i].searchFlights(p.data), flightLinks(p.data));
  return Response.json(body);
}
