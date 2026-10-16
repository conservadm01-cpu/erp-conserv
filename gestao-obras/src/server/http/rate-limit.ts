/**
 * Limitador de janela fixa em memória, por instância do servidor.
 * Usado contra abuso de endpoints públicos. O bloqueio de login é
 * persistido no banco (ver auth.service) e vale entre instâncias.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function hitRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    return false;
  }
  b.count++;
  return b.count > limit;
}

export function resetRateLimits() {
  buckets.clear();
}
