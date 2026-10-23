// Cache em memória com validade (TTL) por chave. Por instância de servidor.

interface Entry {
  value: unknown;
  expires: number;
}

const store = new Map<string, Entry>();
const MAX = 500;

export const TTL = {
  flights: 10 * 60_000, // preços de voo mudam rápido
  lodging: 15 * 60_000,
  activities: 60 * 60_000,
  places: 24 * 60 * 60_000,
  geocode: 7 * 24 * 60 * 60_000,
  weather: 60 * 60_000,
  fx: 60 * 60_000,
  token: 25 * 60_000,
} as const;

export function cacheGet<T>(key: string): T | undefined {
  const e = store.get(key);
  if (!e) return undefined;
  if (e.expires < Date.now()) {
    store.delete(key);
    return undefined;
  }
  return e.value as T;
}

export function cacheSet(key: string, value: unknown, ttlMs: number): void {
  if (store.size >= MAX) {
    const first = store.keys().next().value;
    if (first !== undefined) store.delete(first);
  }
  store.set(key, { value, expires: Date.now() + ttlMs });
}

export function cacheClear(): void {
  store.clear();
}

/** Busca no cache ou executa e guarda; marca `cached` no resultado. */
export async function cached<T extends { cached: boolean }>(key: string, ttlMs: number, run: () => Promise<T>): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit) return { ...hit, cached: true };
  const value = await run();
  cacheSet(key, value, ttlMs);
  return value;
}
