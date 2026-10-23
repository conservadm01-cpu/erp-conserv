import { fxParamsSchema } from "@/lib/providers/types";
import { fxProvider } from "@/lib/providers/registry";
import { providerErrorResponse, readParams } from "@/lib/server/provider-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Contrato usado por src/lib/fx-client.ts:
// GET ?base=BRL&symbols=ARS → { base, rates: { ARS }, source, fetched_at, rate_date, attribution }
export async function GET(req: Request) {
  const p = await readParams(req, fxParamsSchema, "fx", 60);
  if (!p.ok) return p.res;
  try {
    const r = await fxProvider().latest(p.data);
    const first = r.results[0];
    return Response.json({
      base: first.base,
      rates: first.rates,
      source: r.provider,
      fetched_at: r.queried_at,
      rate_date: first.rate_date,
      attribution: r.attribution,
      notice: r.notice,
      cached: r.cached,
    });
  } catch (e) {
    return providerErrorResponse(e);
  }
}
