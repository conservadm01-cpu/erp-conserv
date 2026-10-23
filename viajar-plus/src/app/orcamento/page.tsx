"use client";
import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, FileSpreadsheet, FileText, Paperclip, Pencil, Plus, Receipt, Trash2, Wallet } from "lucide-react";
import { RequireTrip } from "@/components/layout/require-trip";
import { PageHeader, EmptyState, Loading, Notice } from "@/components/ui/states";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { Input, Select, Field } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useBudget, useMoney } from "@/components/budget/use-budget";
import { ExpenseForm } from "@/components/budget/expense-form";
import { PaymentDialog } from "@/components/budget/payment-form";
import { BudgetMeter, ByCategory, Evolution, PerPerson, PlannedVsRealized } from "@/components/budget/charts";
import { costPerDay, costPerTraveler, settleUp, spendingEvolution, type ItemFigures } from "@/lib/budget/calc";
import { budgetCSV, budgetPDF, budgetXLSX, downloadBlob, type ExportData } from "@/lib/budget/export";
import { categoryColor, slugify } from "@/lib/budget/categories";
import { getRepo } from "@/lib/data";
import { uploadDocument } from "@/lib/media/upload";
import { useMediaUrl } from "@/lib/media/use-media-url";
import { useRow } from "@/lib/data/hooks";
import { fmtDate, pct } from "@/lib/format";
import { travelerCount } from "@/lib/trips/service";
import type { Expense, ExpenseStatus, Trip } from "@/lib/types";

const STATUS_TONE: Record<ExpenseStatus, "neutral" | "blue" | "violet" | "amber" | "green" | "red"> = {
  previsto: "neutral",
  cotado: "blue",
  reservado: "violet",
  parcial: "amber",
  pago: "green",
  cancelado: "red",
};
const STATUS_LABEL: Record<ExpenseStatus, string> = { previsto: "Previsto", cotado: "Cotado", reservado: "Reservado", parcial: "Pago parcial", pago: "Pago", cancelado: "Cancelado" };

export default function OrcamentoPage() {
  return <RequireTrip>{(trip) => <Budget trip={trip} />}</RequireTrip>;
}

function Budget({ trip }: { trip: Trip }) {
  const b = useBudget(trip);
  const { fmt, note } = useMoney(trip);
  const toast = useToast();
  const [editing, setEditing] = useState<Expense | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [paying, setPaying] = useState<Expense | null>(null);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const people = travelerCount(trip);
  const t = b.totals;
  const exportData: ExportData = { trip, budgetTotal: b.budgetTotal, expenses: b.expenses, payments: b.payments, categories: b.categories, travelers: b.travelers, basis: b.budget?.per_traveler_basis };
  const fileBase = `orcamento-${slugify(trip.name) || "viagem"}`;

  const visible = useMemo(
    () =>
      b.expenses.filter((e) => {
        const f = b.figures.get(e.id);
        if (statusFilter && f?.status !== statusFilter) return false;
        if (filter && !`${e.description} ${e.supplier} ${e.notes}`.toLowerCase().includes(filter.toLowerCase())) return false;
        return true;
      }),
    [b.expenses, b.figures, filter, statusFilter],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Expense[]>();
    for (const c of b.categories) map.set(c.key, []);
    for (const e of visible) {
      if (!map.has(e.category_key)) map.set(e.category_key, []);
      map.get(e.category_key)!.push(e);
    }
    return [...map.entries()].filter(([, list]) => list.length);
  }, [visible, b.categories]);

  if (b.loading && !b.expenses.length) return <Loading />;

  return (
    <>
      <PageHeader
        eyebrow="Gerador de budget"
        title="Orçamento da viagem"
        description="Totais recalculados automaticamente a partir dos itens e pagamentos. Reserva é compromisso; só pagamento conta como realizado."
        actions={
          <>
            <Button variant="outline" onClick={() => downloadBlob(budgetCSV(exportData), `${fileBase}.csv`, "text/csv;charset=utf-8")}><Download className="h-4 w-4" /> CSV</Button>
            <Button variant="outline" onClick={async () => downloadBlob(await budgetXLSX(exportData), `${fileBase}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
            <Button variant="outline" onClick={async () => downloadBlob(await budgetPDF(exportData), `${fileBase}.pdf`, "application/pdf")}><FileText className="h-4 w-4" /> PDF</Button>
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" /> Novo item</Button>
          </>
        }
      />
      {b.error && <Notice tone="error" className="mb-4">{b.error}</Notice>}
      {note && <Notice className="mb-4">{note}</Notice>}
      {b.alerts.map((a) => (
        <Notice key={a.kind} tone={a.level === "critico" ? "error" : a.level === "aviso" ? "warn" : "info"} className="mb-3" title={a.kind === "realizado" ? "Alerta de orçamento" : "Alerta de projeção"}>
          {a.message}
        </Notice>
      ))}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Stat label="Orçamento" value={fmt(t.budget)} hint={`${fmt(costPerTraveler(t.budget, people))} por pessoa`} />
        <Stat label="Previsto" value={fmt(t.planned)} />
        <Stat label="Cotado" value={fmt(t.quoted)} />
        <Stat label="Reservado" value={fmt(t.reserved)} hint="compromissos" />
        <Stat label="Realizado (pago)" value={fmt(t.realized)} hint={`${pct(t.consumedPct, 1)} do orçamento`} tone={t.consumedPct >= 100 ? "bad" : t.consumedPct >= 90 ? "warn" : "default"} />
        <Stat label="Saldo a pagar" value={fmt(t.pending)} />
        <Stat label="Projeção final" value={fmt(t.projected)} hint="pago + a pagar + estimativas" tone={t.projectedPct > 100 ? "bad" : "default"} />
        <Stat label="Diferença" value={fmt(t.difference)} hint="realizado − previsto" />
        <Stat label="Economia" value={fmt(t.economy)} hint="previsto − realizado" tone={t.economy >= 0 ? "good" : "bad"} />
        <Stat label="Disponível" value={fmt(t.availableProjected)} hint="orçamento − projeção" tone={t.availableProjected < 0 ? "bad" : "good"} />
        <Stat label="Custo por viajante" value={fmt(costPerTraveler(t.projected, people))} hint={`${people} viajantes · projeção`} />
        <Stat label="Custo diário" value={fmt(costPerDay(t.projected, b.days))} hint={`${b.days} dias considerados`} />
      </div>

      <Card className="mb-6">
        <CardBody>
          <BudgetMeter realized={t.realized} pending={t.pending} uncommitted={t.uncommitted} budget={t.budget} fmt={fmt} />
        </CardBody>
      </Card>

      <Tabs
        tabs={[
          {
            value: "itens",
            label: "Itens",
            content: (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Input className="max-w-xs" placeholder="Buscar item…" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Buscar item" />
                  <Select className="w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filtrar por status">
                    <option value="">Todos os status</option>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </Select>
                </div>
                {!b.expenses.length ? (
                  <EmptyState icon={<Wallet />} title="Orçamento vazio" action={<Button onClick={() => { setEditing(null); setFormOpen(true); }}>Adicionar primeiro item</Button>}>
                    Adicione passagens, hospedagem, carro, passeios e alimentação. Você também pode converter cotações salvas em Pesquisar → Comparador.
                  </EmptyState>
                ) : (
                  grouped.map(([key, list]) => (
                    <CategoryBlock
                      key={key}
                      trip={trip}
                      name={b.categories.find((c) => c.key === key)?.name ?? key}
                      color={categoryColor(key, b.categories)}
                      list={list}
                      figures={b.figures}
                      travelers={b.travelers}
                      fmt={fmt}
                      onEdit={(e) => { setEditing(e); setFormOpen(true); }}
                      onPay={setPaying}
                      onToast={toast}
                    />
                  ))
                )}
              </div>
            ),
          },
          {
            value: "graficos",
            label: "Gráficos",
            content: (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card><CardHeader title="Previsto × realizado por categoria" /><CardBody><PlannedVsRealized data={b.byCategory} categories={b.categories} fmt={fmt} /></CardBody></Card>
                <Card><CardHeader title="Despesas por categoria (projeção)" /><CardBody><ByCategory data={b.byCategory} categories={b.categories} fmt={fmt} /></CardBody></Card>
                <Card><CardHeader title="Evolução dos gastos" subtitle="Realizado acumulado por data de pagamento" /><CardBody><Evolution data={spendingEvolution(b.payments)} budget={t.budget} fmt={fmt} /></CardBody></Card>
                <Card><CardHeader title="Custo por pessoa" subtitle="Considera o rateio de cada item" /><CardBody><PerPerson data={b.shares} fmt={fmt} /></CardBody></Card>
              </div>
            ),
          },
          {
            value: "pessoas",
            label: "Rateio e acerto",
            content: <SharesPanel shares={b.shares} fmt={fmt} />,
          },
          {
            value: "config",
            label: "Configurar",
            content: <BudgetSettings trip={trip} />,
          },
        ]}
      />

      <ExpenseForm trip={trip} expense={editing} categories={b.categories} travelers={b.travelers} open={formOpen} onOpenChange={setFormOpen} />
      {paying && (
        <PaymentDialog
          trip={trip}
          expense={paying}
          figures={b.figures.get(paying.id)}
          payments={b.payments}
          travelers={b.travelers}
          open={Boolean(paying)}
          onOpenChange={(v) => !v && setPaying(null)}
        />
      )}
    </>
  );
}

function CategoryBlock({
  trip, name, color, list, figures, travelers, fmt, onEdit, onPay, onToast,
}: {
  trip: Trip; name: string; color: string; list: Expense[]; figures: Map<string, ItemFigures>; travelers: { id: string; name: string }[];
  fmt: (v: number) => string; onEdit: (e: Expense) => void; onPay: (e: Expense) => void; onToast: (m: string, t?: "success" | "error" | "info") => void;
}) {
  const sum = (k: keyof ItemFigures) => list.reduce((s, e) => s + ((figures.get(e.id)?.[k] as number) ?? 0), 0);
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <span className="h-3 w-3 rounded-full" style={{ background: color }} aria-hidden />
        <h3 className="font-semibold">{name}</h3>
        <span className="ml-auto text-sm text-muted">Previsto {fmt(sum("planned"))} · Pago {fmt(sum("paid"))} · Projeção <strong className="text-fg">{fmt(sum("projected"))}</strong></span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Item</th>
              <th className="px-2 py-2 text-right font-medium">Previsto</th>
              <th className="px-2 py-2 text-right font-medium">Cotado</th>
              <th className="px-2 py-2 text-right font-medium">Reservado</th>
              <th className="px-2 py-2 text-right font-medium">Pago</th>
              <th className="px-2 py-2 text-right font-medium">Saldo</th>
              <th className="px-2 py-2 font-medium">Vence</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-4 py-2 text-right font-medium"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.map((e) => {
              const f = figures.get(e.id);
              const overdue = e.due_date && f && f.pending > 0 && e.due_date < new Date().toISOString().slice(0, 10);
              return (
                <tr key={e.id} className="align-top">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{e.description}</div>
                    <div className="text-xs text-muted">
                      {[e.supplier, e.original_currency !== trip.currency ? `${e.quantity} × ${e.unit_price} ${e.original_currency} @ ${e.fx_rate}` : "", travelers.find((t) => t.id === e.responsible_traveler_id)?.name, e.split_mode !== "todos" ? "rateio personalizado" : ""].filter(Boolean).join(" · ")}
                    </div>
                    {f?.overpaid && <div className="mt-1 flex items-center gap-1 text-xs text-amber-600"><AlertTriangle className="h-3 w-3" /> Pago acima do reservado</div>}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{fmt(f?.planned ?? 0)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{f?.quoted ? fmt(f.quoted) : "—"}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{f?.reserved ? fmt(f.reserved) : "—"}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{f?.paid ? fmt(f.paid) : "—"}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{f?.pending ? fmt(f.pending) : "—"}</td>
                  <td className={`px-2 py-2.5 ${overdue ? "font-semibold text-red-600" : ""}`}>{e.due_date ? fmtDate(e.due_date, { day: "2-digit", month: "short" }) : "—"}</td>
                  <td className="px-2 py-2.5">{f && <Badge tone={STATUS_TONE[f.status]}>{STATUS_LABEL[f.status]}</Badge>}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="secondary" onClick={() => onPay(e)}><Receipt className="h-4 w-4" /> Pagar</Button>
                      <ReceiptButton trip={trip} expense={e} onToast={onToast} />
                      <Button size="icon" variant="ghost" aria-label="Editar item" onClick={() => onEdit(e)}><Pencil className="h-4 w-4" /></Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Excluir item"
                        onClick={async () => {
                          const pays = await getRepo().list("payments", { trip_id: trip.id, expense_id: e.id });
                          if (!confirm(pays.length ? `Este item tem ${pays.length} pagamento(s), que também serão excluídos. Continuar?` : "Excluir este item?")) return;
                          for (const p of pays) await getRepo().remove("payments", p.id);
                          await getRepo().remove("expenses", e.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ReceiptButton({ trip, expense, onToast }: { trip: Trip; expense: Expense; onToast: (m: string, t?: "success" | "error" | "info") => void }) {
  const input = useRef<HTMLInputElement>(null);
  const { data: doc } = useRow("documents", expense.receipt_document_id);
  const url = useMediaUrl(doc?.storage_path, "documents");
  const [busy, setBusy] = useState(false);
  if (doc && url)
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-sm text-accent hover:bg-surface-2" title={doc.title}>
        <Paperclip className="h-4 w-4" /> <span className="sr-only">Ver comprovante</span>
      </a>
    );
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={async (ev) => {
          const file = ev.target.files?.[0];
          ev.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            const d = await uploadDocument(trip.id, file, { kind: "comprovante", title: `Comprovante — ${expense.description}`, expense_id: expense.id });
            await getRepo().update("expenses", expense.id, { receipt_document_id: d.id });
            onToast("Comprovante anexado");
          } catch (e) {
            onToast(e instanceof Error ? e.message : String(e), "error");
          } finally {
            setBusy(false);
          }
        }}
      />
      <Button size="icon" variant="ghost" aria-label="Anexar comprovante" loading={busy} onClick={() => input.current?.click()}>
        {!busy && <Paperclip className="h-4 w-4 text-muted" />}
      </Button>
    </>
  );
}

function SharesPanel({ shares, fmt }: { shares: ReturnType<typeof useBudget>["shares"]; fmt: (v: number) => string }) {
  const transfers = settleUp(shares);
  const name = (id: string) => shares.find((s) => s.traveler_id === id)?.name ?? "?";
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Parte de cada viajante" subtitle="Base configurável em “Configurar” (projeção, realizado ou previsto)" />
        <CardBody className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted"><tr><th className="py-2">Viajante</th><th className="py-2 text-right">Parte</th><th className="py-2 text-right">Pagou</th><th className="py-2 text-right">Saldo</th></tr></thead>
            <tbody className="divide-y divide-line">
              {shares.map((s) => (
                <tr key={s.traveler_id}>
                  <td className="py-2">{s.name}</td>
                  <td className="py-2 text-right tabular-nums">{fmt(s.share)}</td>
                  <td className="py-2 text-right tabular-nums">{fmt(s.paid)}</td>
                  <td className={`py-2 text-right tabular-nums ${s.balance > 0 ? "text-emerald-600" : s.balance < 0 ? "text-red-600" : ""}`}>{s.balance > 0 ? "+" : ""}{fmt(s.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">Saldo = quanto a pessoa pagou − a parte dela no que já foi pago. Positivo: tem a receber.</p>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Acerto de contas sugerido" subtitle="Menor número de transferências para equilibrar o que já foi pago" />
        <CardBody>
          {!transfers.length ? (
            <p className="text-sm text-muted">Tudo equilibrado — ninguém deve nada a ninguém (com base nos pagamentos com pagador informado).</p>
          ) : (
            <ul className="space-y-2">
              {transfers.map((tr, i) => (
                <li key={i} className="rounded-lg bg-surface-2 p-3 text-sm"><strong>{name(tr.from)}</strong> paga <strong>{fmt(tr.amount)}</strong> para <strong>{name(tr.to)}</strong></li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function BudgetSettings({ trip }: { trip: Trip }) {
  const b = useBudget(trip);
  const toast = useToast();
  const [newCat, setNewCat] = useState("");
  const budget = b.budget;
  if (!budget) return <Notice tone="warn">Configuração de orçamento não encontrada para esta viagem.</Notice>;
  const save = (patch: Partial<NonNullable<typeof budget>>) =>
    getRepo().update("budgets", budget.id, patch).then(() => toast("Configuração salva")).catch((e) => toast(String(e), "error"));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Limites e cálculo" />
        <CardBody className="space-y-4">
          <Field label={`Orçamento total (${trip.currency})`}>
            {(p) => (
              <Input
                type="number"
                step="0.01"
                min={0}
                {...p}
                defaultValue={budget.total}
                onBlur={async (e) => {
                  const v = Number(e.target.value);
                  if (!(v >= 0)) return;
                  await save({ total: v });
                  await getRepo().update("trips", trip.id, { budget_total: v, budget_per_person: Math.round((v / Math.max(1, travelerCount(trip))) * 100) / 100 });
                }}
              />
            )}
          </Field>
          <Field label="Alertas (% do orçamento)" hint="Separe por vírgula. Padrão: 70, 90, 100.">
            {(p) => (
              <Input
                {...p}
                defaultValue={budget.alert_thresholds.join(", ")}
                onBlur={(e) => {
                  const list = e.target.value.split(/[,;\s]+/).map(Number).filter((n) => n > 0 && n <= 1000);
                  if (list.length) save({ alert_thresholds: [...new Set(list)].sort((a, c) => a - c) });
                }}
              />
            )}
          </Field>
          <Field label="Dias considerados para o custo diário" hint="Vazio = dias corridos da viagem.">
            {(p) => <Input type="number" min={1} {...p} defaultValue={budget.days_considered ?? ""} onBlur={(e) => save({ days_considered: e.target.value ? Number(e.target.value) : null })} />}
          </Field>
          <Field label="Base do custo por viajante">
            {(p) => (
              <Select {...p} defaultValue={budget.per_traveler_basis} onChange={(e) => save({ per_traveler_basis: e.target.value as "projecao" })}>
                <option value="projecao">Projeção final</option>
                <option value="realizado">Realizado (pago)</option>
                <option value="previsto">Previsto</option>
              </Select>
            )}
          </Field>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Categorias" subtitle="Crie categorias personalizadas além das padrão" />
        <CardBody>
          <ul className="mb-3 flex flex-wrap gap-2">
            {b.categories.map((c) => (
              <li key={c.id} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-sm">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} aria-hidden />
                {c.name}
                {c.is_custom && (
                  <button
                    aria-label={`Remover categoria ${c.name}`}
                    className="text-muted hover:text-red-600"
                    onClick={() => {
                      if (b.expenses.some((e) => e.category_key === c.key)) return toast("Há itens nesta categoria. Mova-os antes de remover.", "error");
                      getRepo().remove("budget_categories", c.id);
                    }}
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const name = newCat.trim();
              if (name.length < 2) return;
              const key = `custom_${slugify(name)}`;
              if (b.categories.some((c) => c.key === key)) return toast("Categoria já existe", "error");
              await getRepo().insert("budget_categories", { trip_id: trip.id, key, name, color: "#a16207", is_custom: true, position: b.categories.length });
              setNewCat("");
            }}
          >
            <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Ex.: Presentes" aria-label="Nova categoria" />
            <Button type="submit" variant="outline">Adicionar</Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
