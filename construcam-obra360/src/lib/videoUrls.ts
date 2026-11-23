"use client";

import { supabase } from "@/lib/supabase";

export type SignedSeg = { numero_segmento: number; url: string | null };

/** Links temporários emitidos pelo servidor, que confere a permissão e registra o acesso. */
export async function assinarTrechos(gravacaoId: string, tipo: "historico" | "ao_vivo", segmentos?: number[]): Promise<SignedSeg[]> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Entre novamente.");
  const res = await fetch("/api/videos/assinar", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ gravacaoId, tipo, segmentos })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Erro ${res.status} ao carregar o vídeo.`);
  return json.urls as SignedSeg[];
}

export const RETENCAO_DIAS = 60;
export function diasParaExpirar(inicio: string) {
  const ms = Date.parse(inicio) + RETENCAO_DIAS * 86400_000 - Date.now();
  return Math.max(0, Math.ceil(ms / 86400_000));
}
