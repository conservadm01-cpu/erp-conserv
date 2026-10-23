"use client";
import { Download, FileJson, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { RequireTrip } from "@/components/layout/require-trip";
import { PageHeader, Notice } from "@/components/ui/states";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useBudget, useMoney } from "@/components/budget/use-budget";
import { Evolution, PerPerson, PlannedVsRealized } from "@/components/budget/charts";
import { useRows } from "@/lib/data/hooks";
import { getRepo } from "@/lib/data";
import { budgetCSV, budgetPDF, budgetXLSX, downloadBlob, paymentRows, toCSV, PAYMENT_HEADERS, type ExportData } from "@/lib/budget/export";
import { categoryName, slugify } from "@/lib/budget/categories";
import { costPerDay, costPerTraveler, spendingEvolution } from "@/lib/budget/calc";
import { fmtDate, pct } from "@/lib/format";
import { travelerCount } from "@/lib/trips/service";
import type { TableName, Trip } from "@/lib/types";

const TRIP_TABLES: TableName[] = [
  "trip_members", "travelers", "destinations", "budgets", "budget_categories", "expenses", "payments", "quotes", "search_queries",
  "activities", "itinerary_days", "itinerary_items", "reservations", "documents", "diary_entries", "media_assets", "photo_edits",
  "albums", "album_pages", "video_projects",
];

export default function RelatoriosPage() {
  return <RequireTrip>{(trip) => <Reports trip={trip} />}</RequireTrip>;
}

function Reports({ trip }: { trip: Trip }) {
  const b = useBudget(trip);
  const { fmt, note } = useMoney(trip);
  const where = { trip_id: trip.id };
  const reservations = useRows("reservations", where);
  const quotes = useRows("quotes", where);
  const diary = useRows("diary_entries", where);
  const media = useRows("media_assets", where);
  const items = useRows("itinerary_items", where);
  const people = travelerCount(trip);
  const data: ExportData = { trip, budgetTotal: b.budgetTotal, expenses: b.expenses, payments: b.payments, categories: b.categories, travelers: b.travelers, basis: b.budget?.per_traveler_basis };
  const base = slugify(trip.name) || "viagem";

  async function exportTripJson() {
    const repo = getRepo();
    const out: Record<string, unknown> = { exported_at: new Date().toISOString(), trip };
    for (const t of TRIP_TABLES) out[t] = await repo.list(t, { trip_id: trip.id } as never);
    downloadBlob(JSON.stringify(out, null, 2), `viagem-${base}.json`, "application/json");
  }

  const t = b.totals;
  return (
    <>
      <PageHeader
        eyebrow="Relatórios"
        title="Números e resumo da viagem"
        description="Todos os valores são recalculados a partir dos itens e pagamentos registrados."
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Imprimir</Button>
            <Button variant="outline" onClick={exportTripJson}><FileJson className="h-4 w-4" /> Dados da viagem (JSON)</Button>
          </>
        }
      />
      {note && <Notice className="mb-4">{note}</Notice>}

      <Card className="mb-6">
        <CardHeader title="Exportar orçamento" subtitle="Itens, resumo, categorias, pagamentos e rateio por viajante" />
        <CardBody className="flex flex-wrap gap-2">
          <Button onClick={() => downloadBlob(budgetCSV(data), `orcamento-${base}.csv`, "text/csv;charset=utf-8")}><Download className="h-4 w-4" /> Itens (CSV)</Button>
          <Button onClick={() => downloadBlob(toCSV(PAYMENT_HEADERS, paymentRows(data)), `pagamentos-${base}.csv`, "text/csv;charset=utf-8")}><Download className="h-4 w-4" /> Pagamentos (CSV)</Button>
          <Button onClick={async () => downloadBlob(await budgetXLSX(data), `orcamento-${base}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}><FileSpreadsheet className="h-4 w-4" /> Excel completo</Button>
          <Button onClick={async () => downloadBlob(await budgetPDF(data), `orcamento-${base}.pdf`, "application/pdf")}><FileText className="h-4 w-4" /> PDF</Button>
        </CardBody>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Projeção final" value={fmt(t.projected)} hint={`${pct(t.projectedPct, 0)} do orçamento`} />
        <Stat label="Por viajante" value={fmt(costPerTraveler(t.projected, people))} hint={`${people} pessoas`} />
        <Stat label="Por dia" value={fmt(costPerDay(t.projected, b.days))} hint={`${b.days} dias`} />
        <Stat label="Por família/grupo" value={fmt(t.projected)} hint="custo total do grupo" />
        <Stat label="Reservas" value={reservations.data.length} hint={`${reservations.data.filter((r) => r.status === "confirmada").length} confirmadas`} />
        <Stat label="Cotações" value={quotes.data.length} hint={`${quotes.data.filter((q) => q.status === "convertida").length} no orçamento`} />
        <Stat label="Roteiro" value={items.data.length} hint="atividades planejadas" />
        <Stat label="Memórias" value={media.data.length + diary.data.length} hint={`${media.data.length} mídias · ${diary.data.length} registros`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title="Previsto × realizado" /><CardBody><PlannedVsRealized data={b.byCategory} categories={b.categories} fmt={fmt} /></CardBody></Card>
        <Card><CardHeader title="Evolução dos pagamentos" /><CardBody><Evolution data={spendingEvolution(b.payments)} budget={t.budget} fmt={fmt} /></CardBody></Card>
        <Card><CardHeader title="Custo por pessoa" /><CardBody><PerPerson data={b.shares} fmt={fmt} /></CardBody></Card>
        <Card>
          <CardHeader title="Tabela por categoria" subtitle="Visão em tabela dos mesmos dados dos gráficos" />
          <CardBody className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted">
                <tr><th className="py-2">Categoria</th><th className="py-2 text-right">Previsto</th><th className="py-2 text-right">Pago</th><th className="py-2 text-right">A pagar</th><th className="py-2 text-right">Projeção</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {b.byCategory.map((c) => (
                  <tr key={c.category}>
                    <td className="py-1.5">{categoryName(c.category, b.categories)}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmt(c.planned)}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmt(c.realized)}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmt(c.pending)}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmt(c.projected)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="font-semibold">
                <tr className="border-t-2 border-line"><td className="py-2">Total</td><td className="py-2 text-right">{fmt(t.planned)}</td><td className="py-2 text-right">{fmt(t.realized)}</td><td className="py-2 text-right">{fmt(t.pending)}</td><td className="py-2 text-right">{fmt(t.projected)}</td></tr>
              </tfoot>
            </table>
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Vencimentos com saldo a pagar" />
          <CardBody>
            {(() => {
              const due = b.expenses
                .filter((e) => (b.figures.get(e.id)?.pending ?? 0) > 0)
                .sort((a, c) => (a.due_date ?? "9999").localeCompare(c.due_date ?? "9999"));
              if (!due.length) return <p className="text-sm text-muted">Nenhum compromisso pendente.</p>;
              return (
                <ul className="divide-y divide-line text-sm">
                  {due.map((e) => (
                    <li key={e.id} className="flex justify-between gap-3 py-2">
                      <span>{e.description}</span>
                      <span className="text-muted">{e.due_date ? fmtDate(e.due_date) : "sem vencimento"}</span>
                      <strong className="tabular-nums">{fmt(b.figures.get(e.id)!.pending)}</strong>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
