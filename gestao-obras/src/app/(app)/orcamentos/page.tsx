import type { Metadata } from "next";
import Link from "next/link";
import { requirePageActor } from "@/server/auth/page-context";
import { canAnywhere } from "@/server/authz/authorize";
import { budgetOverview } from "@/server/services/budget.service";
import { PageHeader } from "@/components/ui/PageHeader";
import { Forbidden } from "@/components/Forbidden";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { WorkStatusBadge } from "@/components/works/StatusBadges";

export const metadata: Metadata = { title: "Orçamentos" };
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function BudgetsPage() {
  const actor = await requirePageActor();
  if (!canAnywhere(actor, "budget.read")) return <Forbidden />;
  const rows = await budgetOverview(actor);
  const total = (k: "orcado" | "comprometido" | "medido" | "pago") => rows.reduce((s, r) => s + r[k], 0);
  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader title="Orçamentos e medições" description="Situação financeira das obras no seu escopo. Valores de registro gerencial; não há pagamento automático." />
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {([["Orçado (aprovado)", total("orcado")], ["Comprometido", total("comprometido")], ["Medido (aprovado)", total("medido")], ["Pago (registrado)", total("pago")]] as const).map(([l, v]) => (
          <div key={l} className="card p-4"><dt className="text-xs text-slate-500">{l}</dt><dd className="text-lg font-semibold tabular-nums">{brl(v)}</dd></div>
        ))}
      </dl>
      {rows.length === 0 ? (
        <EmptyState title="Nenhuma obra no seu escopo" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Obra</th><th>Situação</th><th>Orçamento</th><th className="text-right">Orçado</th><th className="text-right">Comprometido</th><th className="text-right">Medido</th><th className="text-right">Saldo</th><th>Aprovações</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/obras/${r.id}?aba=orcamento`} className="text-brand-700 hover:underline">{r.code}</Link><p className="text-xs text-slate-500">{r.title} · {r.unit.name}</p></td>
                  <td><WorkStatusBadge status={r.status} /></td>
                  <td>{r.approvedVersion ? `v${r.approvedVersion} aprovada` : <Badge tone="amber">sem orçamento aprovado</Badge>}</td>
                  <td className="text-right tabular-nums">{brl(r.orcado)}</td>
                  <td className="text-right tabular-nums">{brl(r.comprometido)}</td>
                  <td className="text-right tabular-nums">{brl(r.medido)}</td>
                  <td className={`text-right tabular-nums ${r.saldo < 0 ? "font-semibold text-red-700" : ""}`}>{brl(r.saldo)}</td>
                  <td>{r.pendentes ? <Badge tone="amber">{r.pendentes} pendente(s)</Badge> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
