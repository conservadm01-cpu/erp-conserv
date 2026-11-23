import { NextResponse } from "next/server";
import { adminClient, userClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "obras-videos";
const VALIDADE_S = 600;
// Ao vivo pede um link a cada trecho; registra no máximo um acesso a cada 10 min.
const JANELA_AO_VIVO_MS = 10 * 60 * 1000;

type Body = { gravacaoId?: string; segmentos?: number[]; tipo?: "historico" | "ao_vivo" };

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Requisição inválida." }, { status: 400 }); }
  const { gravacaoId, segmentos } = body;
  const tipo = body.tipo === "ao_vivo" ? "ao_vivo" : "historico";
  if (!gravacaoId || !/^[0-9a-f-]{36}$/i.test(gravacaoId)) return NextResponse.json({ error: "Gravação inválida." }, { status: 400 });
  if (segmentos && (!Array.isArray(segmentos) || segmentos.length > 500 || !segmentos.every(n => Number.isInteger(n) && n >= 0))) {
    return NextResponse.json({ error: "Trechos inválidos." }, { status: 400 });
  }

  try {
    const admin = adminClient();
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
    const user = auth.user;

    // 1) Permissão: a consulta roda COMO o usuário, então o RLS decide.
    const asUser = userClient(token);
    const { data: grav, error: gErr } = await asUser.from("gravacoes").select("id,obra_id").eq("id", gravacaoId).maybeSingle();
    if (gErr) throw gErr;
    if (!grav) return NextResponse.json({ error: "Sem permissão para esta gravação." }, { status: 403 });
    let q = asUser.from("arquivos_video").select("numero_segmento,caminho_storage").eq("gravacao_id", gravacaoId).order("numero_segmento");
    if (segmentos?.length) q = q.in("numero_segmento", segmentos);
    const { data: arquivos, error: aErr } = await q;
    if (aErr) throw aErr;
    if (!arquivos?.length) return NextResponse.json({ urls: [] });

    // 2) Registro do acesso (antes de entregar os links).
    let registrar = true;
    if (tipo === "ao_vivo") {
      const desde = new Date(Date.now() - JANELA_AO_VIVO_MS).toISOString();
      const { data: recente } = await admin.from("acessos_video").select("id")
        .eq("user_id", user.id).eq("gravacao_id", gravacaoId).eq("tipo", "ao_vivo").gte("created_at", desde).limit(1);
      registrar = !recente?.length;
    }
    if (registrar) {
      const { error: logErr } = await admin.from("acessos_video").insert({
        user_id: user.id, email: user.email?.toLowerCase() ?? null, gravacao_id: gravacaoId, obra_id: grav.obra_id,
        tipo, segmentos: arquivos.map(a => a.numero_segmento),
        user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null
      });
      if (logErr) throw logErr; // sem registro, sem vídeo
    }

    // 3) Links temporários.
    const { data: signed, error: sErr } = await admin.storage.from(BUCKET).createSignedUrls(arquivos.map(a => a.caminho_storage), VALIDADE_S);
    if (sErr) throw sErr;
    const porCaminho = new Map(signed?.map(s => [s.path, s.signedUrl]));
    return NextResponse.json({
      urls: arquivos.map(a => ({ numero_segmento: a.numero_segmento, url: porCaminho.get(a.caminho_storage) ?? null }))
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : (e as { message?: string })?.message ?? "Erro ao gerar links.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
