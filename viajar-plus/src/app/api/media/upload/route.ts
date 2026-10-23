import { errorResponse, HttpError, notConfigured, requireTripPermission, requireUser } from "@/lib/server/auth";
import { clientKey, rateLimit, tooMany } from "@/lib/server/rate-limit";
import { log } from "@/lib/server/log";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { validateUpload, type DetectedKind } from "@/lib/media/validate";

export const runtime = "nodejs";

const BUCKETS: Record<string, { perm: "media" | "reservations"; kinds: DetectedKind[] }> = {
  media: { perm: "media", kinds: ["image", "video", "audio"] },
  documents: { perm: "reservations", kinds: ["document", "image"] },
};

/** Upload validado no servidor: autenticação, permissão na viagem, caminho seguro e conteúdo real (magic bytes). */
export async function POST(req: Request) {
  if (!isSupabaseConfigured()) return notConfigured("O envio de arquivos para a nuvem");
  try {
    const { sb, user } = await requireUser();
    const rl = rateLimit(`upload:${clientKey(req, user.id)}`, 120, 60_000);
    if (!rl.ok) return tooMany(rl);

    const form = await req.formData().catch(() => null);
    if (!form) throw new HttpError(400, "Envie os dados como multipart/form-data.");
    const bucket = String(form.get("bucket") ?? "");
    const path = String(form.get("path") ?? "");
    const tripId = String(form.get("trip_id") ?? "");
    const file = form.get("file");

    const cfg = BUCKETS[bucket];
    if (!cfg) throw new HttpError(400, "Destino de armazenamento inválido.");
    if (!(file instanceof Blob)) throw new HttpError(400, "Arquivo ausente.");
    // caminho: <trip_id>/<nome-seguro>.<ext>, sem subpastas nem "..".
    if (!/^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,120}$/i.test(path) || path.includes("..") || !path.startsWith(`${tripId}/`)) {
      throw new HttpError(400, "Caminho de arquivo inválido.");
    }
    await requireTripPermission(sb, tripId, cfg.perm);

    const name = file instanceof File && file.name ? file.name : path.split("/")[1];
    const header = new Uint8Array(await file.slice(0, 32).arrayBuffer());
    const v = validateUpload(name, file.size, header, cfg.kinds);
    if (!v.ok || !v.detected) throw new HttpError(415, v.error ?? "Arquivo recusado.");

    const { error } = await sb.storage.from(bucket).upload(path, file, { contentType: v.detected.mime, upsert: false, cacheControl: "3600" });
    if (error) {
      log.warn("upload.storage_error", { bucket, tripId, message: error.message });
      throw new HttpError(400, "O armazenamento recusou o arquivo (limite de tamanho, tipo ou permissão).");
    }
    log.info("upload.ok", { bucket, tripId, size: file.size, mime: v.detected.mime });
    return Response.json({ path, mime: v.detected.mime });
  } catch (e) {
    if (!(e instanceof HttpError)) log.error("upload.fail", { error: e });
    return errorResponse(e);
  }
}
