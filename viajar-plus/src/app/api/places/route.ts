import { placesParamsSchema } from "@/lib/providers/types";
import { placesProvider } from "@/lib/providers/registry";
import { providerErrorResponse, readParams } from "@/lib/server/provider-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const p = await readParams(req, placesParamsSchema, "places", 20);
  if (!p.ok) return p.res;
  try {
    return Response.json(await placesProvider().places(p.data));
  } catch (e) {
    return providerErrorResponse(e);
  }
}
