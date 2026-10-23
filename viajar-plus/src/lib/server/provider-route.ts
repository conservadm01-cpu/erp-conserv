import "server-only";
import type { ZodType } from "zod";
import { ProviderError } from "@/lib/providers/errors";
import { clientKey, rateLimit, tooMany } from "./rate-limit";

/** Aplica rate limit, lê parâmetros (query GET ou JSON POST) e valida com Zod. */
export async function readParams<T>(req: Request, schema: ZodType<T>, bucket: string, limit = 30): Promise<{ ok: true; data: T } | { ok: false; res: Response }> {
  const rl = rateLimit(`${bucket}:${clientKey(req)}`, limit, 60_000);
  if (!rl.ok) return { ok: false, res: tooMany(rl) };
  let raw: unknown;
  if (req.method === "GET") {
    raw = Object.fromEntries(new URL(req.url).searchParams.entries());
  } else {
    const len = Number(req.headers.get("content-length") ?? 0);
    if (len > 20_000) return { ok: false, res: Response.json({ error: "Requisição muito grande." }, { status: 413 }) };
    raw = await req.json().catch(() => null);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".") || "parâmetros"}: ${i.message}`).join("; ");
    return { ok: false, res: Response.json({ error: `Parâmetros inválidos — ${msg}` }, { status: 400 }) };
  }
  return { ok: true, data: parsed.data };
}

/** Converte erro de provedor em resposta JSON, sem vazar detalhes internos. */
export function providerErrorResponse(e: unknown): Response {
  if (e instanceof ProviderError) {
    return Response.json({ error: e.message, provider: e.provider }, { status: e.status });
  }
  console.error("[provider] erro inesperado:", e instanceof Error ? e.message : "desconhecido");
  return Response.json({ error: "Erro inesperado ao consultar o fornecedor." }, { status: 500 });
}
