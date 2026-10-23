import { randomBytes } from "node:crypto";
import { z } from "zod";
import { errorResponse, HttpError, notConfigured, requireUser } from "@/lib/server/auth";
import { clientKey, rateLimit, tooMany } from "@/lib/server/rate-limit";
import { log } from "@/lib/server/log";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { ROLE_PERMISSIONS } from "@/lib/trips/service";

export const runtime = "nodejs";

const createSchema = z.object({
  action: z.literal("create"),
  trip_id: z.uuid(),
  name: z.string().trim().min(1).max(120),
  email: z.union([z.literal(""), z.email()]).default(""),
  role: z.enum(["editor", "financeiro", "colaborador", "leitor"]),
  permissions: z
    .object({ edit_trip: z.boolean(), budget: z.boolean(), reservations: z.boolean(), diary: z.boolean(), media: z.boolean() })
    .optional(),
});

const acceptSchema = z.object({ action: z.literal("accept"), token: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/) });

/** Convites para familiares: o dono cria um link com papel/permissões; o convidado aceita após login. */
export async function POST(req: Request) {
  if (!isSupabaseConfigured()) return notConfigured("O convite por link");
  try {
    const { sb, user } = await requireUser();
    const rl = rateLimit(`invites:${clientKey(req, user.id)}`, 30, 60_000);
    if (!rl.ok) return tooMany(rl);
    const raw = await req.json().catch(() => null);

    const accept = acceptSchema.safeParse(raw);
    if (accept.success) {
      const { data, error } = await sb.rpc("accept_trip_invite", { p_token: accept.data.token });
      if (error) throw new HttpError(400, error.message.includes("Você já") ? error.message : "Convite inválido, expirado ou já utilizado.");
      log.info("invite.accepted", { user: user.id, trip: data });
      return Response.json({ trip_id: data });
    }

    const parsed = createSchema.safeParse(raw);
    if (!parsed.success) throw new HttpError(400, "Dados do convite inválidos.");
    const { data: isOwner } = await sb.rpc("is_trip_owner", { p_trip: parsed.data.trip_id });
    if (isOwner !== true) throw new HttpError(403, "Somente o proprietário convida participantes.");

    const token = randomBytes(24).toString("base64url");
    const { data: member, error } = await sb
      .from("trip_members")
      .insert({
        trip_id: parsed.data.trip_id,
        name: parsed.data.name,
        email: parsed.data.email,
        role: parsed.data.role,
        permissions: parsed.data.permissions ?? ROLE_PERMISSIONS[parsed.data.role],
        invite_status: "convidado",
        invite_token: token,
      })
      .select("id")
      .single();
    if (error) throw new HttpError(400, "Não foi possível criar o convite.");
    const origin = new URL(req.url).origin;
    log.info("invite.created", { trip: parsed.data.trip_id, role: parsed.data.role });
    return Response.json({ member_id: member.id, url: `${origin}/convite/${token}` });
  } catch (e) {
    return errorResponse(e);
  }
}
