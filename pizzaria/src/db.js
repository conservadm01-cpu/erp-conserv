import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------
// Camada de dados chave/valor. Usa a mesma tabela `app_storage` do
// Supabase do ERP, com todas as chaves prefixadas por "pz:" para não
// misturar com os dados da confecção.
//
// Sem as variáveis VITE_SUPABASE_*, cai no modo demonstração: grava no
// localStorage do navegador. Abas do mesmo navegador compartilham os
// dados, então dá para testar cliente, loja e motoboy em abas separadas.
// ---------------------------------------------------------------------

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const TABLE = "app_storage";
const PREFIX = "pz:";

let supabase = null;
if (url && anonKey) {
  try { supabase = createClient(url, anonKey); } catch (e) { console.error(e); }
}
export const modoDemo = !supabase;
// Versão de teste publicada como artefato: sem GPS, sem mapas externos.
export const modoTeste = import.meta.env.VITE_ARTEFATO === "1";

// localStorage pode estar bloqueado (aba anônima, prévia); nesse caso os
// dados ficam só na memória enquanto a página estiver aberta.
const memoria = new Map();
let temLocalStorage = false;
try { localStorage.setItem("pz-teste", "1"); localStorage.removeItem("pz-teste"); temLocalStorage = true; } catch { /* sem localStorage */ }

export const armazem = {
  get: (k) => (temLocalStorage ? localStorage.getItem(k) : memoria.has(k) ? memoria.get(k) : null),
  set: (k, v) => (temLocalStorage ? localStorage.setItem(k, v) : memoria.set(k, v)),
  del: (k) => (temLocalStorage ? localStorage.removeItem(k) : memoria.delete(k)),
  chaves: () => (temLocalStorage ? Object.keys(localStorage) : [...memoria.keys()]),
};

const local = {
  async get(k) { return armazem.get(k); },
  async set(k, v) { armazem.set(k, v); },
  async del(k) { armazem.del(k); },
  async listValues(prefix) {
    return armazem.chaves().filter((k) => k.startsWith(prefix)).map((k) => armazem.get(k));
  },
};

const remoto = {
  async get(k) {
    const { data, error } = await supabase.from(TABLE).select("value").eq("key", k).maybeSingle();
    if (error) throw error;
    return data ? data.value : null;
  },
  async set(k, v) {
    const { error } = await supabase
      .from(TABLE)
      .upsert({ key: k, value: v, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw error;
  },
  async del(k) {
    const { error } = await supabase.from(TABLE).delete().eq("key", k);
    if (error) throw error;
  },
  async listValues(prefix) {
    const escapado = prefix.replace(/[%_]/g, (m) => "\\" + m);
    const { data, error } = await supabase.from(TABLE).select("value").like("key", escapado + "%");
    if (error) throw error;
    return (data || []).map((r) => r.value);
  },
};

const backend = supabase ? remoto : local;

function parse(v) {
  try { return v == null ? null : JSON.parse(v); } catch { return null; }
}

// Avisa os hooks (nesta aba) que algo mudou, para recarregarem na hora
// em vez de esperar o próximo ciclo de atualização.
function avisar(colecao) {
  window.dispatchEvent(new CustomEvent("pz-mudou", { detail: colecao }));
}

export async function obter(chave) {
  return parse(await backend.get(PREFIX + chave));
}

export async function gravar(chave, valor) {
  await backend.set(PREFIX + chave, JSON.stringify(valor));
  avisar(chave.split(":")[0]);
  return valor;
}

export async function remover(chave) {
  await backend.del(PREFIX + chave);
  avisar(chave.split(":")[0]);
}

// Coleções guardam um registro por chave ("colecao:id"), assim dois
// pedidos feitos ao mesmo tempo não sobrescrevem um ao outro.
export async function listar(colecao) {
  const valores = await backend.listValues(PREFIX + colecao + ":");
  return valores.map(parse).filter(Boolean);
}

export async function salvarItem(colecao, item) {
  return gravar(`${colecao}:${item.id}`, item);
}

export async function removerItem(colecao, id) {
  return remover(`${colecao}:${id}`);
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
