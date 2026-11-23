// Supabase de demonstração: banco em memória no navegador, com as mesmas
// regras de acesso das migrações 003/004 (reescritas em TypeScript).
// Usado só no build de demonstração (demo/build.mjs), nunca no app real.

type Row = Record<string, any>;
type Err = { message: string; code?: string };
type Res<T = any> = { data: T; error: Err | null };

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const daysAgo = (d: number, h = 9, m = 0) => { const x = new Date(); x.setDate(x.getDate() - d); x.setHours(h, m, 0, 0); return x.toISOString(); };

export const TERMO_VERSAO = "2026-11";
export const IDS = {
  condo: "c0000000-0000-4000-8000-000000000001",
  u104: "d0000000-0000-4000-8000-000000000104", u201: "d0000000-0000-4000-8000-000000000201", u32: "d0000000-0000-4000-8000-000000000032",
  obraCozinha: "e0000000-0000-4000-8000-000000000001", obraPiso: "e0000000-0000-4000-8000-000000000002"
};
export const PESSOAS = [
  { email: "pedreiro@demo.com", papel: "Profissional", desc: "Grava as obras da cozinha (A-104) e do piso (B-32)" },
  { email: "dono@demo.com", papel: "Proprietário", desc: "Dono do apartamento A-104" },
  { email: "sindico@demo.com", papel: "Síndico", desc: "Administra o Residencial Jardins" },
  { email: "admin@demo.com", papel: "Admin da plataforma", desc: "Cria condomínios e vê todos" }
];

// ------------------------------------------------------------------ dados
export const db: Record<string, Row[]> = {};
export const objects = new Map<string, Blob>();
const users = new Map<string, string>(); // email -> id

export function resetData() {
  for (const k of Object.keys(db)) delete db[k];
  objects.clear(); users.clear();
  PESSOAS.forEach(p => users.set(p.email, uuid()));
  users.set("intruso@demo.com", uuid());
  Object.assign(db, {
    plataforma_admins: [{ email: "admin@demo.com", created_at: now() }],
    condominios: [{ id: IDS.condo, nome: "Residencial Jardins", cidade: "Campinas", created_at: daysAgo(40) }],
    unidades: [
      { id: IDS.u104, condominio_id: IDS.condo, bloco: "A", identificador: "104", created_at: daysAgo(40) },
      { id: IDS.u201, condominio_id: IDS.condo, bloco: "A", identificador: "201", created_at: daysAgo(40) },
      { id: IDS.u32, condominio_id: IDS.condo, bloco: "B", identificador: "32", created_at: daysAgo(30) }
    ],
    obras: [
      { id: IDS.obraCozinha, unidade_id: IDS.u104, descricao: "Reforma de cozinha", empresa: "Construtora Alfa", status: "ativa", created_at: daysAgo(3) },
      { id: IDS.obraPiso, unidade_id: IDS.u32, descricao: "Troca de piso", empresa: "Pisos Silva", status: "ativa", created_at: daysAgo(8) }
    ],
    membros: [
      { id: uuid(), email: "sindico@demo.com", nome: null, papel: "admin", condominio_id: IDS.condo, unidade_id: null, obra_id: null, created_at: daysAgo(40) },
      { id: uuid(), email: "dono@demo.com", nome: null, papel: "proprietario", condominio_id: null, unidade_id: IDS.u104, obra_id: null, created_at: daysAgo(12) },
      { id: uuid(), email: "pedreiro@demo.com", nome: null, papel: "profissional", condominio_id: null, unidade_id: null, obra_id: IDS.obraCozinha, created_at: daysAgo(12) },
      { id: uuid(), email: "pedreiro@demo.com", nome: null, papel: "profissional", condominio_id: null, unidade_id: null, obra_id: IDS.obraPiso, created_at: daysAgo(5) }
    ],
    gravacoes: [], arquivos_video: [], ocorrencias: [], termos_aceite: [], acessos_video: []
  });
}
resetData();

export const userId = (email: string) => users.get(email)!;

// ------------------------------------------------------------------ sessão
let session: { access_token: string; user: { id: string; email: string } } | null = null;
const authListeners = new Set<(ev: string, s: typeof session) => void>();
function setSession(email: string | null) {
  session = email ? { access_token: "demo-" + email, user: { id: users.get(email)!, email } } : null;
  authListeners.forEach(l => l(email ? "SIGNED_IN" : "SIGNED_OUT", session));
}
export const currentEmail = () => session?.user.email ?? null;
export function loginAs(email: string | null) { setSession(email); }

// ------------------------------------------------------------------ regras (espelham o SQL)
const me = () => session?.user.email ?? "";
const uid = () => session?.user.id ?? "";
const find = (t: string, id: string | null | undefined) => db[t].find(r => r.id === id);
const isPlat = () => db.plataforma_admins.some(p => p.email === me());
const condoDaUnidade = (u?: string | null) => find("unidades", u)?.condominio_id ?? null;
const condoDaObra = (o?: string | null) => condoDaUnidade(find("obras", o)?.unidade_id);
const adminCondo = (c?: string | null) => !!c && (isPlat() || db.membros.some(m => m.papel === "admin" && m.condominio_id === c && m.email === me()));
const donoUnidade = (u?: string | null) => db.membros.some(m => m.papel === "proprietario" && m.unidade_id === u && m.email === me());
const profObra = (o?: string | null) => db.membros.some(m => m.papel === "profissional" && m.obra_id === o && m.email === me());
const acompanhaObra = (o?: string | null) => { const ob = find("obras", o); return !!ob && (adminCondo(condoDaObra(o)) || donoUnidade(ob.unidade_id)); };
const veObra = (o?: string | null) => acompanhaObra(o) || profObra(o);
const participaUnidade = (u: string) => adminCondo(condoDaUnidade(u)) || donoUnidade(u) || db.obras.some(o => o.unidade_id === u && profObra(o.id));
const participaCondo = (c: string) => adminCondo(c) || db.membros.some(m => m.email === me() && (condoDaUnidade(m.unidade_id) === c || condoDaObra(m.obra_id) === c));
const veGravacao = (g?: string | null) => { const x = find("gravacoes", g); return !!x && (x.profissional_id === uid() || (!!x.obra_id && acompanhaObra(x.obra_id))); };
const condoDoMembro = (m: Row) => m.condominio_id ?? condoDaUnidade(m.unidade_id) ?? condoDaObra(m.obra_id);
const aceitouTermo = () => db.termos_aceite.some(t => t.user_id === uid() && t.versao === TERMO_VERSAO);

const canSelect: Record<string, (r: Row) => boolean> = {
  plataforma_admins: r => r.email === me(),
  condominios: r => participaCondo(r.id),
  unidades: r => participaUnidade(r.id),
  obras: r => veObra(r.id),
  membros: r => r.email === me() || adminCondo(condoDoMembro(r)) || (r.papel === "profissional" && acompanhaObra(r.obra_id)),
  gravacoes: r => veGravacao(r.id),
  arquivos_video: r => veGravacao(r.gravacao_id),
  ocorrencias: r => veGravacao(r.gravacao_id),
  termos_aceite: r => r.user_id === uid() || db.membros.some(m => m.email === r.email && adminCondo(condoDoMembro(m))),
  acessos_video: r => r.user_id === uid() || (!!r.obra_id && acompanhaObra(r.obra_id))
};
const canInsert: Record<string, (r: Row) => boolean> = {
  condominios: () => isPlat(),
  unidades: r => adminCondo(r.condominio_id),
  obras: r => adminCondo(condoDaUnidade(r.unidade_id)),
  membros: r => adminCondo(condoDoMembro(r)),
  gravacoes: r => r.profissional_id === uid() && !!r.obra_id && profObra(r.obra_id) && find("obras", r.obra_id)?.status === "ativa" && aceitouTermo(),
  arquivos_video: r => find("gravacoes", r.gravacao_id)?.profissional_id === uid(),
  ocorrencias: r => r.solicitado_por === uid() && r.obra_id === find("gravacoes", r.gravacao_id)?.obra_id && acompanhaObra(r.obra_id) && r.status === "aberta" && r.preservada === true,
  termos_aceite: r => r.user_id === uid() && r.email === me() && r.versao === TERMO_VERSAO
};
const canUpdate: Record<string, (r: Row) => boolean> = {
  condominios: r => adminCondo(r.id),
  unidades: r => adminCondo(r.condominio_id),
  obras: r => adminCondo(condoDaUnidade(r.unidade_id)),
  gravacoes: r => r.profissional_id === uid(),
  ocorrencias: r => adminCondo(condoDaObra(r.obra_id))
};
const canDelete: Record<string, (r: Row) => boolean> = {
  condominios: () => isPlat(),
  unidades: r => adminCondo(r.condominio_id),
  obras: r => adminCondo(condoDaUnidade(r.unidade_id)),
  membros: r => adminCondo(condoDoMembro(r))
};

const rls = (t: string): Err => ({ code: "42501", message: `new row violates row-level security policy for table "${t}"` });
const dup = (c: string): Err => ({ code: "23505", message: `duplicate key value violates unique constraint "${c}"` });

function defaults(t: string, r: Row): Row {
  const base: Row = { id: uuid(), created_at: now() };
  if (t === "obras") base.status = "ativa";
  if (t === "gravacoes") Object.assign(base, { status: "iniciada", inicio: now(), fim: null, metadata: {} });
  if (t === "ocorrencias") Object.assign(base, { status: "aberta", preservada: true, solicitado_por: uid(), solicitado_email: me(), resolucao: null, resolvido_por: null, resolvido_em: null });
  if (t === "termos_aceite") Object.assign(base, { user_id: uid(), email: me(), aceito_em: now() });
  if (t === "membros") Object.assign(base, { nome: null, condominio_id: null, unidade_id: null, obra_id: null });
  return { ...base, ...r };
}
function unique(t: string, r: Row): Err | null {
  if (t === "unidades" && db.unidades.some(u => u.condominio_id === r.condominio_id && u.bloco === r.bloco && u.identificador === r.identificador)) return dup("unidades_condominio_id_bloco_identificador_key");
  if (t === "membros") {
    if (r.email !== String(r.email).trim().toLowerCase() || !/^[^@\s]+@[^@\s]+$/.test(r.email)) return { code: "23514", message: 'new row for relation "membros" violates check constraint "membros_email_check"' };
    const alvo = (m: Row) => m.condominio_id ?? m.unidade_id ?? m.obra_id;
    if (db.membros.some(m => m.email === r.email && m.papel === r.papel && alvo(m) === alvo(r))) return dup("membros_unico");
  }
  if (t === "termos_aceite" && db.termos_aceite.some(x => x.user_id === r.user_id && x.versao === r.versao)) return dup("termos_aceite_user_id_versao_key");
  if (t === "arquivos_video" && db.arquivos_video.some(x => x.gravacao_id === r.gravacao_id && x.numero_segmento === r.numero_segmento)) return dup("arquivos_video_gravacao_id_numero_segmento_key");
  if (t === "gravacoes" && db.gravacoes.some(x => x.id === r.id)) return dup("gravacoes_pkey");
  return null;
}

// ------------------------------------------------------------------ query builder (subconjunto do supabase-js)
type Filter = (r: Row) => boolean;
const pick = (r: Row, cols: string) => cols === "*" ? { ...r } : Object.fromEntries(cols.split(",").map(c => c.trim()).map(c => [c, r[c] ?? null]));
const tick = () => new Promise(r => setTimeout(r, 40 + Math.random() * 80)); // latência de rede

class Query implements PromiseLike<Res> {
  private op: "select" | "insert" | "update" | "delete" = "select";
  private cols = "*";
  private filters: Filter[] = [];
  private orders: [string, boolean][] = [];
  private lim: number | null = null;
  private payload: any = null;
  private returning = false;
  private mode: "many" | "single" | "maybe" = "many";
  constructor(private t: string) { }
  select(cols = "*") { if (this.op === "select") this.cols = cols; else { this.returning = true; this.cols = cols; } return this; }
  insert(v: any) { this.op = "insert"; this.payload = v; return this; }
  update(v: any) { this.op = "update"; this.payload = v; return this; }
  delete() { this.op = "delete"; return this; }
  eq(c: string, v: any) { this.filters.push(r => r[c] === v); return this; }
  neq(c: string, v: any) { this.filters.push(r => r[c] !== v); return this; }
  in(c: string, vs: any[]) { this.filters.push(r => vs.includes(r[c])); return this; }
  gt(c: string, v: any) { this.filters.push(r => r[c] > v); return this; }
  gte(c: string, v: any) { this.filters.push(r => r[c] >= v); return this; }
  order(c: string, o?: { ascending?: boolean }) { this.orders.push([c, o?.ascending !== false]); return this; }
  limit(n: number) { this.lim = n; return this; }
  single() { this.mode = "single"; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }
  then<A = Res, B = never>(ok?: ((v: Res) => A | PromiseLike<A>) | null, bad?: ((e: any) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return tick().then(() => this.run()).then(ok, bad);
  }
  private run(): Res {
    const t = this.t, table = db[t];
    if (!table) return { data: null, error: { message: `relation "public.${t}" does not exist` } };
    if (!session) return { data: null, error: { message: "JWT expired" } };
    const match = (r: Row) => this.filters.every(f => f(r));
    let out: Row[] = [];
    if (this.op === "select") {
      out = table.filter(r => canSelect[t]?.(r) && match(r));
    } else if (this.op === "insert") {
      const rows = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((r: Row) => defaults(t, r));
      for (const r of rows) {
        const u = unique(t, r); if (u) return { data: null, error: u };
        if (!canInsert[t]?.(r)) return { data: null, error: rls(t) };
      }
      table.push(...rows); out = rows;
    } else if (this.op === "update") {
      for (const r of table.filter(r => canSelect[t]?.(r) && canUpdate[t]?.(r) && match(r))) {
        const next = { ...r, ...this.payload };
        if (!canUpdate[t](next)) return { data: null, error: rls(t) };
        Object.assign(r, this.payload); out.push(r);
      }
    } else {
      out = table.filter(r => canSelect[t]?.(r) && canDelete[t]?.(r) && match(r));
      db[t] = table.filter(r => !out.includes(r));
    }
    for (const [c, asc] of [...this.orders].reverse()) out = [...out].sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1));
    if (this.lim != null) out = out.slice(0, this.lim);
    if (this.op !== "select" && !this.returning) return { data: null, error: null };
    const data = out.map(r => pick(r, this.cols));
    if (this.mode === "single") return data.length === 1 ? { data: data[0], error: null } : { data: null, error: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" } };
    if (this.mode === "maybe") return { data: data[0] ?? null, error: null };
    return { data, error: null };
  }
}

// ------------------------------------------------------------------ Storage e retenção
export function storagePut(path: string, blob: Blob): Err | null {
  const g = find("gravacoes", path.split("/")[0]);
  if (!g || g.profissional_id !== uid()) return rls("objects");
  if (objects.has(path)) return { message: "The resource already exists", code: "409" };
  objects.set(path, blob); return null;
}
const urlCache = new Map<string, string>();
/** Equivale à rota /api/videos/assinar: confere, registra o acesso e entrega links. */
export function assinar(gravacaoId: string, tipo: "historico" | "ao_vivo", segmentos?: number[]) {
  if (!session) throw new Error("Sessão expirada. Entre novamente.");
  const g = find("gravacoes", gravacaoId);
  if (!g || !veGravacao(gravacaoId)) throw new Error("Sem permissão para esta gravação.");
  const arqs = db.arquivos_video.filter(a => a.gravacao_id === gravacaoId && (!segmentos?.length || segmentos.includes(a.numero_segmento)))
    .sort((a, b) => a.numero_segmento - b.numero_segmento);
  if (!arqs.length) return [];
  const recente = tipo === "ao_vivo" && db.acessos_video.some(a => a.user_id === uid() && a.gravacao_id === gravacaoId && a.tipo === "ao_vivo" && Date.now() - Date.parse(a.created_at) < 600_000);
  if (!recente) db.acessos_video.push({ id: db.acessos_video.length + 1, user_id: uid(), email: me(), gravacao_id: gravacaoId, obra_id: g.obra_id, tipo, segmentos: arqs.map(a => a.numero_segmento), created_at: now() });
  return arqs.map(a => {
    const blob = objects.get(a.caminho_storage);
    let url = urlCache.get(a.caminho_storage);
    if (blob && !url) { url = URL.createObjectURL(blob); urlCache.set(a.caminho_storage, url); }
    return { numero_segmento: a.numero_segmento, url: url ?? null };
  });
}
/** Avança o relógio: tudo o que existe fica N dias mais velho. */
export function envelhecer(dias: number) {
  const shift = (iso: string | null) => iso ? new Date(Date.parse(iso) - dias * 86400_000).toISOString() : iso;
  db.gravacoes.forEach(g => { g.inicio = shift(g.inicio); g.fim = shift(g.fim); });
  db.arquivos_video.forEach(a => { a.inicio_segmento = shift(a.inicio_segmento); a.created_at = shift(a.created_at); });
}
/** Equivale à rotina /api/cron/retencao. */
export function retencao(dias = 60) {
  const limite = Date.now() - dias * 86400_000;
  const preservado = (a: Row) => db.ocorrencias.some(o => o.gravacao_id === a.gravacao_id && o.preservada &&
    (o.segmento_inicio == null || (a.numero_segmento >= o.segmento_inicio && a.numero_segmento <= (o.segmento_fim ?? o.segmento_inicio))));
  const apagar = db.arquivos_video.filter(a => Date.parse(a.inicio_segmento ?? a.created_at) < limite && !preservado(a));
  apagar.forEach(a => { objects.delete(a.caminho_storage); const u = urlCache.get(a.caminho_storage); if (u) URL.revokeObjectURL(u); urlCache.delete(a.caminho_storage); });
  db.arquivos_video = db.arquivos_video.filter(a => !apagar.includes(a));
  let expiradas = 0;
  new Set(apagar.map(a => a.gravacao_id)).forEach(id => {
    const g = find("gravacoes", id);
    if (g && !db.arquivos_video.some(a => a.gravacao_id === id)) { g.status = "expirada"; expiradas++; }
  });
  return { trechosApagados: apagar.length, gravacoesExpiradas: expiradas, preservados: db.arquivos_video.filter(preservado).length };
}

// ------------------------------------------------------------------ cliente
export const supabase = {
  from: (t: string) => new Query(t),
  rpc: async (fn: string) => {
    await tick();
    if (fn === "termo_versao_atual") return { data: TERMO_VERSAO, error: null };
    return { data: null, error: { message: `function ${fn} does not exist` } };
  },
  auth: {
    getSession: async () => ({ data: { session }, error: null }),
    getUser: async () => ({ data: { user: session?.user ?? null }, error: null }),
    onAuthStateChange(cb: (ev: string, s: typeof session) => void) {
      authListeners.add(cb);
      return { data: { subscription: { unsubscribe: () => authListeners.delete(cb) } } };
    },
    async signInWithPassword({ email }: { email: string; password: string }) {
      await tick();
      const e = email.trim().toLowerCase();
      if (!users.has(e)) return { data: null, error: { message: "Invalid login credentials" } };
      setSession(e); return { data: { session }, error: null };
    },
    async signInWithOtp() {
      await tick();
      return { data: null, error: { message: "Na demonstração não há envio de e-mail. Use o botão “Demo” para entrar como uma das pessoas de exemplo (senha: qualquer uma)." } };
    },
    async signOut() { setSession(null); return { error: null }; }
  },
  storage: {
    from: () => ({
      async upload(path: string, blob: Blob) { await tick(); const e = storagePut(path, blob); return { data: e ? null : { path }, error: e }; }
    })
  }
};
export const isSupabaseConfigured = true;
