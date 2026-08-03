import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------
// Este arquivo recria a API window.storage (get/set/delete/list) que o
// app usa para persistir dados, só que usando o Supabase como banco em
// vez do armazenamento interno do ambiente de artifacts do Claude.
//
// O app original só usa dados "compartilhados" (o segundo argumento
// `shared` é sempre `true` em todo o código) — ou seja, todo mundo na
// fábrica lê e grava na mesma tabela, sem separação por usuário. Por
// isso a tabela é única e simples: uma linha por chave.
// ---------------------------------------------------------------------

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error(
    "Faltam as variáveis VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. " +
    "Configure o arquivo .env (veja .env.example) e reinicie o servidor."
  );
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const TABLE = "app_storage";

async function get(key) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("key, value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { key: data.key, value: data.value, shared: true };
}

async function set(key, value) {
  const { error } = await supabase
    .from(TABLE)
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
  return { key, value, shared: true };
}

async function del(key) {
  const { error } = await supabase.from(TABLE).delete().eq("key", key);
  if (error) throw error;
  return { key, deleted: true, shared: true };
}

async function list(prefix) {
  let query = supabase.from(TABLE).select("key");
  if (prefix) {
    // Escapa os curingas do LIKE do Postgres antes de usar o prefixo.
    const escapado = prefix.replace(/[%_]/g, (m) => `\\${m}`);
    query = query.like("key", `${escapado}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return { keys: (data || []).map((r) => r.key), prefix: prefix || undefined, shared: true };
}

// O app sempre chama window.storage.<método>(chave, shared) — o segundo
// argumento é ignorado aqui de propósito, já que toda a base é
// compartilhada entre os usuários do app.
export function instalarStorageGlobal() {
  window.storage = {
    get: (key) => get(key),
    set: (key, value) => set(key, value),
    delete: (key) => del(key),
    list: (prefix) => list(prefix),
  };
}
