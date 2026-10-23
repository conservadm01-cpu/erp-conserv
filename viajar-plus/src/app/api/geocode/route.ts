import { geocodeParamsSchema } from "@/lib/providers/types";
import { mapsProvider } from "@/lib/providers/registry";
import { providerErrorResponse, readParams } from "@/lib/server/provider-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const p = await readParams(req, geocodeParamsSchema, "geocode", 20);
  if (!p.ok) return p.res;
  try {
    return Response.json(await mapsProvider().geocode(p.data));
  } catch (e) {
    return providerErrorResponse(e);
  }
}
