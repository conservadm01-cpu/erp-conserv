import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { requirePageActor } from "@/server/auth/page-context";
import { canAnywhere } from "@/server/authz/authorize";
import { getDashboard } from "@/server/services/dashboard.service";
import { listOrgUnits } from "@/server/services/org-unit.service";
import { listWorkCatalogs } from "@/server/services/work.service";
import { PageHeader } from "@/components/ui/PageHeader";
import { Forbidden } from "@/components/Forbidden";
import { WORK_STATUS } from "@/components/works/labels";

export const metadata: Metadata = { title: "Painel" };

const filterSchema = z.object({
  unitId: z.string().uuid().optional(),
  typeCode: z.string().max(40).optional(),
  status: z.enum(["RASCUNHO", "SOLICITADA", "EM_TRIAGEM", "EM_APROVACAO", "APROVADA", "EM_EXECUCAO", "SUSPENSA", "EM_VISTORIA", "CONCLUIDA", "REJEITADA", "ARQUIVADA"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

function Stat({ label, value, href, tone = "default" }: { label: string; value: number; href?: string; tone?: "default" | "warn" | "bad" }) {
  const color = value > 0 && tone === "warn" ? "text-amber-700" : value > 0 && tone === "bad" ? "text-red-700" : "text-slate-900";
  const body = (
    <div className={`card h-full p-4 ${href ? "hover:border-brand-500" : ""}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{value.toLocaleString("pt-BR")}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function Money({ label, value }: { label: string; value: number }) {
  return (
    <div className="card h-full p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
    </div>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePageActor();
  if (!canAnywhere(actor, "dashboard.view")) return <Forbidden />;
  const sp = await searchParams;
  const parsed = filterSchema.safeParse(Object.fromEntries(Object.entries(sp).filter(([, v]) => v)));
  const f = parsed.success ? parsed.data : {};
  const [d, units, { types }] = await Promise.all([getDashboard(actor, f), listOrgUnits(actor, { status: "ATIVA" }), listWorkCatalogs()]);
  const w = d.works;
  const maxStatus = w ? Math.max(1, ...Object.values(w.byStatus)) : 1;

  return (
    <div className="space-y-8">
      <PageHeader title="Painel" description="Indicadores calculados a partir do banco de dados, limitados ao seu escopo de acesso." />

      {w && (
        <>
          <form className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-7" aria-label="Filtros do painel">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="unitId">Região / unidade</label>
              <select id="unitId" name="unitId" defaultValue={f.unitId ?? ""} className="input">
                <option value="">Todo o escopo</option>
                {units.map((u) => <option key={u.id} value={u.id}>{"— ".repeat(u.depth)}{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="typeCode">Tipo de obra</label>
              <select id="typeCode" name="typeCode" defaultValue={f.typeCode ?? ""} className="input">
                <option value="">Todos</option>
                {types.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="status">Situação</label>
              <select id="status" name="status" defaultValue={f.status ?? ""} className="input">
                <option value="">Todas</option>
                {Object.entries(WORK_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div><label className="label" htmlFor="from">Cadastro de</label><input id="from" name="from" type="date" defaultValue={sp.from} className="input" /></div>
            <div><label className="label" htmlFor="to">até</label><input id="to" name="to" type="date" defaultValue={sp.to} className="input" /></div>
            <div className="flex items-end">
              <button className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">Filtrar</button>
            </div>
          </form>

          <section aria-labelledby="sec-obras">
            <h2 id="sec-obras" className="mb-3 text-sm font-semibold text-slate-700">Obras</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Stat label="Total" value={w.total} href="/obras" />
              <Stat label="Em planejamento" value={w.planejamento} />
              <Stat label="Em execução" value={w.execucao} href="/obras?status=EM_EXECUCAO" />
              <Stat label="Suspensas" value={w.suspensas} tone="warn" href="/obras?status=SUSPENSA" />
              <Stat label="Concluídas" value={w.concluidas} href="/obras?status=CONCLUIDA" />
            </div>
            {w.total > 0 && (
              <div className="card mt-3 p-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Obras por situação</p>
                <ul className="space-y-1.5">
                  {Object.entries(WORK_STATUS).filter(([k]) => w.byStatus[k]).map(([k, v]) => (
                    <li key={k} className="grid grid-cols-[9rem_1fr_2.5rem] items-center gap-2 text-sm">
                      <span className="truncate">{v.label}</span>
                      <span className="h-2.5 rounded-full bg-slate-100"><span className="block h-2.5 rounded-full bg-brand-500" style={{ width: `${(w.byStatus[k]! / maxStatus) * 100}%` }} /></span>
                      <span className="text-right tabular-nums">{w.byStatus[k]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section aria-labelledby="sec-docs">
            <h2 id="sec-docs" className="mb-3 text-sm font-semibold text-slate-700">Documentos, prazos e aprovações</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
              <Stat label="Aguardando análise" value={w.documentos.pendentes} tone="warn" href="/documentos?status=ENVIADO" />
              <Stat label="Vencidos" value={w.documentos.vencidos} tone="bad" href="/documentos?status=VENCIDO" />
              <Stat label="Vencem em 30 dias" value={w.documentos.aVencer30} tone="warn" href="/documentos?expiring=30" />
              <Stat label="Etapas atrasadas" value={w.etapasAtrasadas} tone="bad" />
              <Stat label="Obras com atraso" value={w.obrasComAtraso} tone="bad" />
              {w.aprovacoesPendentes !== null && <Stat label="Aprovações pendentes" value={w.aprovacoesPendentes} tone="warn" href="/aprovacoes" />}
            </div>
          </section>

          {w.seguranca && (
            <section aria-labelledby="sec-seg">
              <h2 id="sec-seg" className="mb-3 text-sm font-semibold text-slate-700">Segurança do trabalho</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Stat label="Ações corretivas abertas" value={w.seguranca.acoesAbertas} tone="warn" href="/seguranca/acoes" />
                <Stat label="Ações atrasadas" value={w.seguranca.acoesAtrasadas} tone="bad" href="/seguranca/acoes" />
                <Stat label="Inspeções em andamento" value={w.seguranca.inspecoesPendentes} tone="warn" href="/seguranca/inspecoes" />
              </div>
            </section>
          )}

          {w.financeiro && (
            <section aria-labelledby="sec-fin">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="sec-fin" className="text-sm font-semibold text-slate-700">Financeiro (registro gerencial)</h2>
                <Link href="/orcamentos" className="text-sm text-brand-700 hover:underline">Ver por obra</Link>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Money label="Orçado (aprovado)" value={w.financeiro.orcado} />
                <Money label="Comprometido" value={w.financeiro.comprometido} />
                <Money label="Medido (aprovado)" value={w.financeiro.realizado} />
                <Money label="Pago (registrado)" value={w.financeiro.pago} />
              </div>
            </section>
          )}
          {canAnywhere(actor, "report.generate") && (
            <p className="text-sm"><Link href="/relatorios" className="text-brand-700 hover:underline">Gerar relatórios em PDF (inclui visão consolidada por região)</Link></p>
          )}
        </>
      )}

      <section aria-labelledby="sec-org">
        <h2 id="sec-org" className="mb-3 text-sm font-semibold text-slate-700">Estrutura organizacional</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {d.units.map((u) => <Stat key={u.typeCode} label={`${u.typeName} (ativas)`} value={u.ativas} href={canAnywhere(actor, "org.read") ? "/organizacao" : undefined} />)}
        </div>
      </section>

      {d.users && (
        <section aria-labelledby="sec-users">
          <h2 id="sec-users" className="mb-3 text-sm font-semibold text-slate-700">Usuários</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Ativos" value={d.users.ativos} href="/usuarios" />
            <Stat label="Bloqueados" value={d.users.bloqueados} tone="warn" href="/usuarios?status=BLOQUEADO" />
            <Stat label="Inativos" value={d.users.inativos} href="/usuarios?status=INATIVO" />
            <Stat label="Ativos sem MFA" value={d.users.semMfa} tone="warn" />
          </div>
        </section>
      )}

      {d.deniedLast24h !== null && (
        <section aria-labelledby="sec-sec">
          <h2 id="sec-sec" className="mb-3 text-sm font-semibold text-slate-700">Segurança</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="Falhas e negativas (24h)" value={d.deniedLast24h} tone="warn" href="/auditoria?result=NEGADO" />
          </div>
        </section>
      )}
    </div>
  );
}
