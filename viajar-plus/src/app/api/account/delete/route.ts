import { createClient } from "@supabase/supabase-js";
import { errorResponse, HttpError, notConfigured, requireUser } from "@/lib/server/auth";
import { clientKey, rateLimit, tooMany } from "@/lib/server/rate-limit";
import { log } from "@/lib/server/log";
import { isSupabaseConfigured, SUPABASE_URL } from "@/lib/supabase/config";
import { DELETE_CONFIRMATION } from "@/lib/privacy/constants";

export const runtime = "nodejs";

/**
 * LGPD — eliminação: apaga os arquivos das viagens de que o usuário é dono e a conta.
 * As viagens próprias são removidas em cascata; nas viagens de terceiros o vínculo é removido.
 * A chave service role é usada SOMENTE aqui, no servidor, e nunca chega ao navegador.
 */
export async function POST(req: Request) {
  if (!isSupabaseConfigured()) return notConfigured("A exclusão de conta na nuvem");
  try {
    const { sb, user } = await requireUser();
    const rl = rateLimit(`delete:${clientKey(req, user.id)}`, 3, 3_600_000);
    if (!rl.ok) return tooMany(rl);
    const body = (await req.json().catch(() => ({}))) as { confirm?: string };
    if (body.confirm !== DELETE_CONFIRMATION) throw new HttpError(400, `Digite exatamente "${DELETE_CONFIRMATION}" para confirmar.`);

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) throw new HttpError(501, "Exclusão automática indisponível: SUPABASE_SERVICE_ROLE_KEY não configurada no servidor. Solicite a exclusão ao controlador dos dados.");

    const { data: paths, error } = await sb.rpc("my_owned_storage_paths");
    if (error) throw new HttpError(500, "Não foi possível listar seus arquivos.");
    const byBucket = new Map<string, string[]>();
    for (const p of (paths ?? []) as { bucket: string; path: string }[]) {
      byBucket.set(p.bucket, [...(byBucket.get(p.bucket) ?? []), p.path]);
    }
    const admin = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    for (const [bucket, list] of byBucket) {
      for (let i = 0; i < list.length; i += 500) {
        const { error: rmErr } = await admin.storage.from(bucket).remove(list.slice(i, i + 500));
        if (rmErr) throw new HttpError(500, "Falha ao apagar arquivos; nada foi excluído da conta. Tente novamente.");
      }
    }
    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) throw new HttpError(500, "Arquivos apagados, mas a conta não pôde ser excluída. Tente novamente.");
    await sb.auth.signOut();
    log.info("lgpd.delete", { user: user.id, files: paths?.length ?? 0 });
    return Response.json({ ok: true });
  } catch (e) {
    if (!(e instanceof HttpError)) log.error("lgpd.delete_fail", { error: e });
    return errorResponse(e);
  }
}
