import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------
// Recria a API window.storage (get/set/delete/list) que o app usa para
// persistir dados, usando o Supabase como banco.
//
// O app só usa dados "compartilhados" — todo mundo na fábrica lê e grava
// na mesma tabela. Por isso a tabela é única: uma linha por chave.
// ---------------------------------------------------------------------

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const TABLE = "app_storage";

// Corrigido: antes, se as variáveis de ambiente não estivessem
// configuradas no Vercel, o createClient() estourava um erro logo no
// carregamento do módulo e a página inteira ficava em branco/erro, sem
// nenhuma pista do que aconteceu. Agora a falta de configuração é
// detectada antes, o app não quebra, e a pessoa vê na tela exatamente o
// que precisa fazer.
const configurado = !!(supabaseUrl && supabaseAnonKey);

let supabase = null;
let erroDeInicializacao = null;
if (configurado) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  } catch (e) {
    erroDeInicializacao = e;
  }
}

function mostrarAvisoDeConfiguracao(detalhe) {
  const alvo = document.getElementById("root") || document.body;
  alvo.innerHTML = [
    '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;',
    'background:#f4efe2;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#2a2015;">',
    '<div style="max-width:520px;background:#fffdf7;border:1px dashed #cdb98a;border-radius:14px;padding:28px;">',
    '<div style="font-size:11px;font-weight:700;letter-spacing:1.2px;color:#6b5d49;text-transform:uppercase;">Controle de Produção</div>',
    '<h1 style="font-size:20px;color:#1c2b39;margin:6px 0 12px;">Falta configurar a conexão com o banco</h1>',
    '<p style="font-size:14px;line-height:1.55;color:#6b5d49;margin:0 0 14px;">O site subiu, mas não consegue falar com o Supabase porque as variáveis de ambiente não chegaram até aqui. Sem isso não dá para carregar nem salvar nada.</p>',
    '<ol style="font-size:14px;line-height:1.7;color:#2a2015;padding-left:20px;margin:0 0 14px;">',
    '<li>No painel do Vercel, abra <b>Settings &rarr; Environment Variables</b></li>',
    '<li>Confirme que existem <b>VITE_SUPABASE_URL</b> e <b>VITE_SUPABASE_ANON_KEY</b>, marcadas para <b>Production</b></li>',
    '<li>Vá em <b>Deployments</b> e faça um <b>Redeploy</b> — variáveis novas só valem a partir de um build novo</li>',
    '</ol>',
    '<p style="font-size:12.5px;color:#a3937a;margin:0;">Os valores ficam no Supabase em <b>Project Settings &rarr; API</b> (Project URL e a chave <i>anon public</i>).',
    detalhe ? '<br><br>Detalhe técnico: ' + detalhe : '',
    '</p></div></div>'
  ].join('');
}

async function get(key) {
  const { data, error } = await supabase.from(TABLE).select("key, value").eq("key", key).maybeSingle();
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
    const escapado = prefix.replace(/[%_]/g, (m) => "\\" + m);
    query = query.like("key", escapado + "%");
  }
  const { data, error } = await query;
  if (error) throw error;
  return { keys: (data || []).map((r) => r.key), prefix: prefix || undefined, shared: true };
}

// Retorna true quando está tudo certo para montar o app; false quando
// faltou configuração (nesse caso já mostrou o aviso na tela).
export function instalarStorageGlobal() {
  if (!configurado || !supabase) {
    console.error("Faltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, ou são inválidas. Configure no Vercel e refaça o deploy.");
    mostrarAvisoDeConfiguracao(erroDeInicializacao ? erroDeInicializacao.message : null);
    return false;
  }
  window.storage = {
    get: (key) => get(key),
    set: (key, value) => set(key, value),
    delete: (key) => del(key),
    list: (prefix) => list(prefix),
  };
  return true;
}
