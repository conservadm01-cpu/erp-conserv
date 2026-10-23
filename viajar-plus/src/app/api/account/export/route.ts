import { errorResponse, notConfigured, requireUser } from "@/lib/server/auth";
import { clientKey, rateLimit, tooMany } from "@/lib/server/rate-limit";
import { log } from "@/lib/server/log";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const runtime = "nodejs";

const TABLES = [
  "trips", "trip_members", "destinations", "travelers", "search_queries", "quotes", "flight_options", "lodging_options",
  "rental_options", "activities", "itinerary_days", "itinerary_items", "budgets", "budget_categories", "expenses", "payments",
  "reservations", "documents", "diary_entries", "media_assets", "photo_edits", "albums", "album_pages", "video_projects", "notifications",
] as const;

/** LGPD — portabilidade: exporta em JSON todos os dados acessíveis ao titular. Arquivos são listados com URLs assinadas de 1 hora. */
export async function GET(req: Request) {
  if (!isSupabaseConfigured()) return notConfigured("A exportação na nuvem");
  try {
    const { sb, user } = await requireUser();
    const rl = rateLimit(`export:${clientKey(req, user.id)}`, 5, 3_600_000);
    if (!rl.ok) return tooMany(rl);

    const { data: profile } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
    const tables: Record<string, unknown[]> = {};
    for (const t of TABLES) {
      const { data, error } = await sb.from(t).select("*");
      tables[t] = error ? [] : (data ?? []);
    }
    const files: { bucket: string; path: string; signed_url: string | null }[] = [];
    for (const m of tables.media_assets as { storage_path: string }[]) {
      const { data } = await sb.storage.from("media").createSignedUrl(m.storage_path, 3600);
      files.push({ bucket: "media", path: m.storage_path, signed_url: data?.signedUrl ?? null });
    }
    for (const d of tables.documents as { storage_path: string }[]) {
      const { data } = await sb.storage.from("documents").createSignedUrl(d.storage_path, 3600);
      files.push({ bucket: "documents", path: d.storage_path, signed_url: data?.signedUrl ?? null });
    }
    log.info("lgpd.export", { user: user.id });
    const body = JSON.stringify(
      {
        exported_at: new Date().toISOString(),
        account: { id: user.id, email: user.email, created_at: user.created_at },
        profile,
        tables,
        files,
        note: "As URLs dos arquivos expiram em 1 hora. Gere uma nova exportação se precisar baixá-los depois.",
      },
      null,
      2,
    );
    return new Response(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="viajar-plus-meus-dados-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
