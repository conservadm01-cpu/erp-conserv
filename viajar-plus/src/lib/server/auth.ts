import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { supabaseServer } from "@/lib/supabase/server";
import type { MemberPermissions } from "@/lib/types";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
  return Response.json({ error: "Erro interno. Tente novamente." }, { status: 500 });
}

/** Resposta padrão quando o Supabase não está configurado (modo demonstração local). */
export function notConfigured(feature: string): Response {
  return Response.json(
    { error: `${feature} exige o Supabase configurado. No modo demonstração local esta operação é feita no próprio navegador.` },
    { status: 501 },
  );
}

/** Exige usuário autenticado (sessão validada no servidor do Supabase via getUser). */
export async function requireUser(): Promise<{ sb: SupabaseClient; user: User }> {
  if (!isSupabaseConfigured()) throw new HttpError(501, "Supabase não configurado.");
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Faça login para continuar.");
  return { sb, user: data.user };
}

export type TripPermission = keyof MemberPermissions;

/** Verifica no banco (função has_trip_permission, a mesma usada pelas políticas RLS). */
export async function requireTripPermission(sb: SupabaseClient, tripId: string, perm: TripPermission): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(tripId)) throw new HttpError(400, "Viagem inválida.");
  const { data, error } = await sb.rpc("has_trip_permission", { p_trip: tripId, p_perm: perm });
  if (error) throw new HttpError(500, "Não foi possível verificar a permissão.");
  if (data !== true) throw new HttpError(403, "Você não tem permissão para esta ação nesta viagem.");
}
