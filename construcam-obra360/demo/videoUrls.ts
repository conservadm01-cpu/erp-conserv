// Versão de demonstração de src/lib/videoUrls.ts: em vez da rota do servidor,
// o "servidor" em memória confere a permissão, registra o acesso e entrega o link.
import { assinar } from "./fakeSupabase";

export type SignedSeg = { numero_segmento: number; url: string | null };
export async function assinarTrechos(gravacaoId: string, tipo: "historico" | "ao_vivo", segmentos?: number[]): Promise<SignedSeg[]> {
  await new Promise(r => setTimeout(r, 120));
  return assinar(gravacaoId, tipo, segmentos);
}
export const RETENCAO_DIAS = 60;
export function diasParaExpirar(inicio: string) {
  const ms = Date.parse(inicio) + RETENCAO_DIAS * 86400_000 - Date.now();
  return Math.max(0, Math.ceil(ms / 86400_000));
}
