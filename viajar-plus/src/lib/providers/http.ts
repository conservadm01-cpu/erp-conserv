import { ProviderUnavailable, RateLimited } from "./errors";

export const USER_AGENT = "VIAJAR-plus/0.1 (+https://github.com/conservadm01-cpu/erp-conserv)";

export interface FetchOpts extends RequestInit {
  timeoutMs?: number;
}

/** fetch com timeout e tradução de erros HTTP para erros tipados. */
export async function fetchJson<T>(provider: string, url: string, opts: FetchOpts = {}): Promise<T> {
  const { timeoutMs = 12_000, headers, ...rest } = opts;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, { ...rest, headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...headers }, signal: ctrl.signal });
  } catch (e) {
    const aborted = (e as Error)?.name === "AbortError";
    throw new ProviderUnavailable(provider, aborted ? `sem resposta em ${Math.round(timeoutMs / 1000)}s` : "falha de rede");
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 429) {
    const ra = Number(res.headers.get("retry-after"));
    throw new RateLimited(provider, Number.isFinite(ra) && ra > 0 ? ra : null);
  }
  if (!res.ok) throw new ProviderUnavailable(provider, `HTTP ${res.status}`);
  try {
    return (await res.json()) as T;
  } catch {
    throw new ProviderUnavailable(provider, "resposta inválida");
  }
}

/** Executa tentativas em sequência (fallback de endpoints); propaga o último erro. */
export async function firstOk<T>(attempts: (() => Promise<T>)[]): Promise<T> {
  let last: unknown;
  for (const a of attempts) {
    try {
      return await a();
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

/** Fila simples para respeitar 1 requisição/segundo (política do Nominatim). */
export function throttle(intervalMs: number) {
  let next = 0;
  return async () => {
    const now = Date.now();
    const wait = Math.max(0, next - now);
    next = Math.max(now, next) + intervalMs;
    if (wait) await new Promise((r) => setTimeout(r, wait));
  };
}

export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** "PT2H35M" -> 155 */
export function isoDurationToMin(d: string | null | undefined): number | null {
  if (!d) return null;
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(d);
  if (!m) return null;
  return (Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0)) * 60 + Number(m[3] ?? 0);
}
