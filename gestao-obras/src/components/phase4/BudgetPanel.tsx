import { Badge } from "../ui/Badge";
import { Alert } from "../ui/Alert";
import { EmptyState } from "../ui/EmptyState";
import { ActionButton, EntityForm, Reveal } from "../ui/EntityForm";
import { BUDGET_CATEGORY, BUDGET_STATUS, COST_KIND, COST_STATUS, REQUEST_STATUS } from "../works/labels";
import { opts } from "../phase3/labels";
import { MeasurementForm } from "./MeasurementForm";
import { formatDay } from "@/lib/format";
import type { getWorkBudget } from "@/server/services/budget.service";

type B = Awaited<ReturnType<typeof getWorkBudget>>;
const brl = (v: number | { toString(): string }) => Number(v.toString()).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const lineFields = (companies: { id: string; legalName: string }[]) => [
  { name: "category", label: "Categoria", type: "select" as const, required: true, options: opts(BUDGET_CATEGORY) },
  { name: "description", label: "Descrição", required: true, maxLength: 300 },
  { name: "unit", label: "Unidade", required: true, maxLength: 20, placeholder: "un, m², h…" },
  { name: "quantity", label: "Quantidade", type: "number" as const, required: true },
  { name: "unitPrice", label: "Preço unitário (R$)", type: "number" as const, required: true },
  { name: "companyId", label: "Fornecedor", type: "select" as const, options: companies.map((c) => ({ value: c.id, label: c.legalName })) },
];

export function BudgetPanel({ b, companies, contracts, documents }: { b: B; companies: { id: string; legalName: string }[]; contracts: { id: string; number: string }[]; documents: { id: string; title: string }[] }) {
  const workId = b.work.id;
  const draft = b.budgets.find((x) => x.status === "RASCUNHO");
  const approved = b.budgets.find((x) => x.status === "APROVADO");
  const s = b.summary;
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Resumo financeiro {s.approvedVersion ? `(orçamento aprovado v${s.approvedVersion})` : "(sem orçamento aprovado)"}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          {([["Orçado", s.totals.orcado], ["Contratado", s.totals.contratado], ["Comprometido", s.totals.comprometido], ["Medido", s.totals.medido], ["Pago (registro)", s.totals.pago], ["Saldo a comprometer", s.totals.saldo]] as const).map(([l, v]) => (
            <div key={l} className="card p-3"><p className="text-xs uppercase tracking-wide text-slate-500">{l}</p><p className={`mt-1 font-semibold tabular-nums ${l === "Saldo a comprometer" && v < 0 ? "text-red-700" : ""}`}>{brl(v)}</p></div>
          ))}
        </div>
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Categoria</th><th className="text-right">Orçado</th><th className="text-right">Contratado</th><th className="text-right">Comprometido</th><th className="text-right">Medido</th><th className="text-right">Pago</th><th className="text-right">Desvio</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {s.rows.map((r) => (
                <tr key={r.category}>
                  <td>{BUDGET_CATEGORY[r.category]}</td>
                  <td className="text-right tabular-nums">{brl(r.orcado)}</td>
                  <td className="text-right tabular-nums">{brl(r.contratado)}</td>
                  <td className="text-right tabular-nums">{brl(r.comprometido)}</td>
                  <td className="text-right tabular-nums">{brl(r.medido)}</td>
                  <td className="text-right tabular-nums">{brl(r.pago)}</td>
                  <td className="text-right tabular-nums">{r.desvio > 0 ? <span className={r.alerta ? "font-semibold text-red-700" : "text-amber-800"}>+{brl(r.desvio)} ({r.desvioPct}%)</span> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500">Desvio: realizado (o maior entre medido e contratado+comprometido) acima do orçado. Alerta a partir de {s.threshold}% (configurável). O sistema registra pagamentos, mas não os executa.</p>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700">Versões do orçamento</h2>
          {b.canManage && !b.budgets.some((x) => ["RASCUNHO", "EM_APROVACAO"].includes(x.status)) && (
            <Reveal label={approved ? "Nova versão / aditivo" : "Elaborar orçamento"}>
              <EntityForm action={`/api/works/${workId}/budgets`} initial={{ copyFromApproved: true, reason: approved ? "" : "Orçamento inicial" }} fields={[{ name: "reason", label: "Motivo da versão", required: true, maxLength: 1000 }, { name: "contractId", label: "Contrato/aditivo relacionado", type: "select", options: contracts.map((c) => ({ value: c.id, label: c.number })) }, { name: "copyFromApproved", label: "Partir das linhas do orçamento aprovado", type: "checkbox" }]} />
            </Reveal>
          )}
        </div>
        {b.budgets.length === 0 ? <EmptyState title="Nenhum orçamento elaborado" /> : b.budgets.map((v) => (
          <details key={v.id} className="card p-4" open={v.status === "RASCUNHO" || (v.status === "APROVADO" && !draft)}>
            <summary className="cursor-pointer text-sm font-medium">Versão {v.version} · {BUDGET_STATUS[v.status]} · {brl(v.total)} · {v.reason}</summary>
            <div className="mt-3 space-y-3">
              {v.lines.length === 0 ? <p className="text-sm text-slate-500">Sem linhas.</p> : (
                <div className="overflow-x-auto">
                  <table className="table-base">
                    <thead><tr><th>Categoria</th><th>Descrição</th><th className="text-right">Qtd.</th><th>Un.</th><th className="text-right">Preço unit.</th><th className="text-right">Total</th>{v.status === "RASCUNHO" && b.canManage && <th><span className="sr-only">Ações</span></th>}</tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {v.lines.map((l) => (
                        <tr key={l.id}>
                          <td>{BUDGET_CATEGORY[l.category]}</td>
                          <td>{l.description}</td>
                          <td className="text-right tabular-nums">{l.quantity.toString()}</td>
                          <td>{l.unit}</td>
                          <td className="text-right tabular-nums">{brl(l.unitPrice)}</td>
                          <td className="text-right tabular-nums">{brl(l.quantity.mul(l.unitPrice).toDecimalPlaces(2))}</td>
                          {v.status === "RASCUNHO" && b.canManage && (
                            <td className="space-y-1">
                              <Reveal label="Editar" variant="secondary">
                                <EntityForm action={`/api/works/${workId}/budgets/${v.id}/lines/${l.id}`} method="PUT" initial={{ category: l.category, description: l.description, unit: l.unit, quantity: l.quantity.toString(), unitPrice: l.unitPrice.toString(), companyId: l.companyId ?? "" }} fields={lineFields(companies)} />
                              </Reveal>
                              <ActionButton label="Remover" variant="ghost" method="DELETE" action={`/api/works/${workId}/budgets/${v.id}/lines/${l.id}`} confirmText="Remover linha?" />
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {v.status === "RASCUNHO" && b.canManage && (
                <div className="flex flex-wrap gap-2">
                  <Reveal label="Incluir linha" variant="secondary"><EntityForm action={`/api/works/${workId}/budgets/${v.id}/lines`} fields={lineFields(companies)} /></Reveal>
                  <ActionButton label="Submeter à aprovação" variant="primary" action={`/api/works/${workId}/budgets/${v.id}/submit`} body={{ note: null }} confirmText="Depois de submetida, a versão não pode ser alterada. Confirmar?" />
                </div>
              )}
            </div>
          </details>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700">Lançamentos</h2>
          {b.canManage && (
            <Reveal label="Registrar lançamento" variant="secondary">
              <EntityForm
                action={`/api/works/${workId}/costs`}
                initial={{ date: new Date().toISOString().slice(0, 10) }}
                fields={[
                  { name: "kind", label: "Tipo", type: "select", required: true, options: opts(COST_KIND), hint: "Compromissos de despesa vão para a aprovação central conforme as alçadas." },
                  { name: "category", label: "Categoria", type: "select", required: true, options: opts(BUDGET_CATEGORY) },
                  { name: "amount", label: "Valor (R$)", type: "number", required: true },
                  { name: "date", label: "Data", type: "date", required: true },
                  { name: "description", label: "Descrição", required: true, maxLength: 500, span: 2 },
                  { name: "lineKey", label: "Item do orçamento", type: "select", options: (approved?.lines ?? []).map((l) => ({ value: l.lineKey, label: l.description })) },
                  { name: "companyId", label: "Fornecedor", type: "select", options: companies.map((c) => ({ value: c.id, label: c.legalName })) },
                  { name: "contractId", label: "Contrato", type: "select", options: contracts.map((c) => ({ value: c.id, label: c.number })) },
                  { name: "documentId", label: "Cotação / nota fiscal (documento da obra)", type: "select", options: documents.map((d) => ({ value: d.id, label: d.title })) },
                ]}
              />
            </Reveal>
          )}
        </div>
        {b.costs.length === 0 ? <EmptyState title="Nenhum lançamento" /> : (
          <div className="card overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th className="text-right">Valor</th><th>Situação</th><th><span className="sr-only">Ações</span></th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {b.costs.map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap">{formatDay(c.date)}</td>
                    <td>{COST_KIND[c.kind]?.split(" (")[0]}</td>
                    <td>{BUDGET_CATEGORY[c.category]}</td>
                    <td>{c.description}</td>
                    <td className="text-right tabular-nums">{brl(c.amount)}</td>
                    <td><Badge tone={c.status === "APROVADO" || c.status === "REGISTRADO" ? "green" : c.status === "AGUARDANDO_APROVACAO" ? "amber" : "slate"}>{COST_STATUS[c.status]}</Badge></td>
                    <td>{b.canManage && ["REGISTRADO", "AGUARDANDO_APROVACAO"].includes(c.status) && <ActionButton label="Cancelar" variant="ghost" method="DELETE" action={`/api/works/${workId}/costs/${c.id}`} confirmText="Cancelar lançamento?" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Medições</h2>
        {!approved ? <Alert tone="info">As medições usam os itens e preços do orçamento aprovado.</Alert> : b.canManage && (
          <Reveal label="Nova medição" variant="secondary">
            <MeasurementForm workId={workId} lines={approved.lines.map((l) => ({ lineKey: l.lineKey, description: l.description, unit: l.unit, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), measured: b.measured[l.lineKey]?.qty ?? 0 }))} />
          </Reveal>
        )}
        {b.measurements.length === 0 ? <EmptyState title="Nenhuma medição" /> : (
          <ul className="space-y-2">
            {b.measurements.map((m) => (
              <li key={m.id} className="card flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span>Medição nº {m.number} · {formatDay(m.periodStart)} a {formatDay(m.periodEnd)} · {m.items.length} item(ns) · <strong className="tabular-nums">{brl(m.total)}</strong> · {REQUEST_STATUS[m.status]}</span>
                {b.canManage && m.status === "RASCUNHO" && <ActionButton label="Submeter à aprovação" variant="primary" action={`/api/works/${workId}/measurements/${m.id}/submit`} body={{ note: null }} confirmText="Submeter medição?" />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
