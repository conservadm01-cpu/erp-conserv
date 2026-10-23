"use client";
import type { SearchApiResponse } from "@/lib/providers/search-response";
import type { ProviderResponse } from "@/lib/providers/types";

async function parse<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`);
  return json;
}

export async function postSearch<T>(path: string, body: unknown): Promise<SearchApiResponse<T>> {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return parse<SearchApiResponse<T>>(res);
}

export async function getProvider<T>(path: string, params: Record<string, string | number>): Promise<ProviderResponse<T>> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  return parse<ProviderResponse<T>>(await fetch(`${path}?${qs}`));
}
