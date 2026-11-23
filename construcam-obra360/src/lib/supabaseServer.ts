import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Somente no servidor. A service role ignora o RLS: use-a apenas depois de
// conferir a permissão do usuário com um cliente "como o usuário".
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

const opts = { auth: { persistSession: false, autoRefreshToken: false } };

export function adminClient(): SupabaseClient {
  if (!url || !service) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.");
  return createClient(url, service, opts);
}

/** Cliente que age como o usuário do token: todas as consultas passam pelo RLS. */
export function userClient(accessToken: string): SupabaseClient {
  if (!url || !anon) throw new Error("Supabase não configurado.");
  return createClient(url, anon, { ...opts, global: { headers: { Authorization: `Bearer ${accessToken}` } } });
}
