import { carParamsSchema } from "@/lib/providers/types";
import { carProviders } from "@/lib/providers/registry";
import { carLinks } from "@/lib/providers/links";
import { runProviders } from "@/lib/providers/search-response";
import { readParams } from "@/lib/server/provider-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const p = await readParams(req, carParamsSchema, "search:cars", 20);
  if (!p.ok) return p.res;
  const providers = carProviders();
  const body = await runProviders(providers, (i) => providers[i].searchCars(p.data), carLinks(p.data));
  return Response.json(body);
}
