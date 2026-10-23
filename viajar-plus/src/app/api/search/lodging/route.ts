import { lodgingParamsSchema } from "@/lib/providers/types";
import { lodgingProviders } from "@/lib/providers/registry";
import { lodgingLinks } from "@/lib/providers/links";
import { runProviders } from "@/lib/providers/search-response";
import { readParams } from "@/lib/server/provider-route";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = lodgingParamsSchema.and(z.object({ children_ages: z.array(z.coerce.number().int().min(0).max(17)).max(20).default([]) }));

export async function POST(req: Request) {
  const p = await readParams(req, schema, "search:lodging", 12);
  if (!p.ok) return p.res;
  const providers = lodgingProviders();
  const body = await runProviders(providers, (i) => providers[i].searchLodging(p.data), lodgingLinks(p.data));
  return Response.json(body);
}
