import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "obras-videos";

// Apaga os trechos com mais de RETENCAO_DIAS (padrão 60) que não estejam
// preservados por ocorrência. Chamada diariamente pelo Vercel Cron
// (vercel.json), que envia "Authorization: Bearer $CRON_SECRET".
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const dias = Math.max(1, parseInt(process.env.RETENCAO_DIAS ?? "60", 10) || 60);
  const admin = adminClient();
  const inicio = Date.now();
  let apagados = 0, lotes = 0;
  const gravacoes = new Set<string>();
  const erros: string[] = [];

  while (Date.now() - inicio < 45_000 && lotes < 50) {
    const { data, error } = await admin.rpc("trechos_expirados", { dias, limite: 100 });
    if (error) { erros.push(error.message); break; }
    const lote = (data ?? []) as { id: string; gravacao_id: string; caminho_storage: string }[];
    if (!lote.length) break;
    lotes++;
    // Arquivo primeiro; só então o registro. Se o Storage falhar, nada é apagado do banco.
    const { error: rmErr } = await admin.storage.from(BUCKET).remove(lote.map(t => t.caminho_storage));
    if (rmErr) { erros.push(rmErr.message); break; }
    const { error: delErr } = await admin.from("arquivos_video").delete().in("id", lote.map(t => t.id));
    if (delErr) { erros.push(delErr.message); break; }
    apagados += lote.length;
    lote.forEach(t => gravacoes.add(t.gravacao_id));
  }

  let expiradas = 0;
  if (gravacoes.size) {
    const { data, error } = await admin.rpc("marcar_gravacoes_expiradas", { ids: [...gravacoes] });
    if (error) erros.push(error.message); else expiradas = data as number;
  }
  return NextResponse.json({ dias, trechosApagados: apagados, gravacoesExpiradas: expiradas, erros }, { status: erros.length ? 500 : 200 });
}
