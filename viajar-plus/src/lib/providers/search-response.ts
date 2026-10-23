import type { ExternalLink } from "./links";
import type { ProviderResponse } from "./types";

/** Resposta das rotas de pesquisa: junta provedores configurados + links externos. */
export interface SearchApiResponse<T> {
  available: boolean; // há ao menos uma API real (ou fictícia em dev) configurada
  results: T[];
  sources: { provider: string; queried_at: string; cached: boolean; attribution: string; notice?: string }[];
  errors: string[];
  links: ExternalLink[];
  notice: string;
}

export const UNAVAILABLE_NOTICE =
  "Consulta real indisponível: nenhuma API autorizada está configurada para este tipo de busca. Use os links externos abaixo e registre a cotação manualmente.";

export async function runProviders<T>(providers: { name: string }[], call: (i: number) => Promise<ProviderResponse<T>>, links: ExternalLink[]): Promise<SearchApiResponse<T>> {
  if (!providers.length) return { available: false, results: [], sources: [], errors: [], links, notice: UNAVAILABLE_NOTICE };
  const settled = await Promise.allSettled(providers.map((_, i) => call(i)));
  const out: SearchApiResponse<T> = { available: true, results: [], sources: [], errors: [], links, notice: "" };
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") {
      out.results.push(...s.value.results);
      out.sources.push({ provider: s.value.provider, queried_at: s.value.queried_at, cached: s.value.cached, attribution: s.value.attribution, notice: s.value.notice });
    } else {
      out.errors.push(s.reason instanceof Error ? s.reason.message : `${providers[i].name}: erro`);
    }
  });
  out.notice = out.results.length
    ? "Resultados das fontes consultadas, sem garantia de cobrir todo o mercado. Confirme preço e disponibilidade no fornecedor antes de comprar."
    : out.errors.length
      ? "As fontes configuradas não responderam. Tente novamente ou use os links externos."
      : "Nenhum resultado encontrado nas fontes configuradas.";
  return out;
}
