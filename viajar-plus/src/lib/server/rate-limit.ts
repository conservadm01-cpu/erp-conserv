import "server-only";

// Limitador de requisições em memória (janela deslizante por chave).
// Em produção com várias instâncias, troque por um armazenamento compartilhado
// (ex.: Upstash Redis); a interface permanece a mesma.

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const b = buckets.get(key) ?? { hits: [] };
  b.hits = b.hits.filter((t) => now - t < windowMs);
  if (b.hits.length >= limit) {
    buckets.set(key, b);
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil((windowMs - (now - b.hits[0])) / 1000) };
  }
  b.hits.push(now);
  buckets.set(key, b);
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (!v.hits.some((t) => now - t < windowMs)) buckets.delete(k);
  }
  return { ok: true, remaining: limit - b.hits.length, retryAfterSec: 0 };
}

/** Identifica o cliente pelo usuário autenticado ou, na falta, pelo IP informado pelo proxy. */
export function clientKey(req: Request, userId?: string | null): string {
  if (userId) return `u:${userId}`;
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `ip:${fwd || req.headers.get("x-real-ip") || "local"}`;
}

export function tooMany(r: RateLimitResult): Response {
  return Response.json(
    { error: "Muitas requisições. Tente novamente em instantes." },
    { status: 429, headers: { "Retry-After": String(r.retryAfterSec) } },
  );
}
