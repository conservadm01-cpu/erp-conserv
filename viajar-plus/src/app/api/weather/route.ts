import { weatherParamsSchema } from "@/lib/providers/types";
import { weatherProvider } from "@/lib/providers/registry";
import { providerErrorResponse, readParams } from "@/lib/server/provider-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const p = await readParams(req, weatherParamsSchema, "weather", 30);
  if (!p.ok) return p.res;
  try {
    return Response.json(await weatherProvider().weather(p.data));
  } catch (e) {
    return providerErrorResponse(e);
  }
}
