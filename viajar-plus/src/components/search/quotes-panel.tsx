"use client";
import { useMemo, useState } from "react";
import { Ban, ExternalLink as ExtIcon, Trash2, TrendingDown, TrendingUp, Minus, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Modal } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/field";
import { EmptyState, Loading, Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { getRepo } from "@/lib/data";
import { useRows } from "@/lib/data/hooks";
import { fmtDateTime, money } from "@/lib/format";
import { compareQuotes, QUOTE_TYPE_CATEGORY, QUOTE_TYPE_LABEL, quotePatchForExpense, quoteToExpense, quoteTrends, UNIT_LABEL, type NormalizedQuote } from "@/lib/quotes/compare";
import { travelerCount } from "@/lib/trips/service";
import type { Quote, QuoteType, Trip } from "@/lib/types";

const SOURCE_LABEL: Record<Quote["source"], string> = { api: "API", manual: "Manual", demo: "Demonstração" };

export function QuotesPanel({ trip, only }: { trip: Trip; only?: QuoteType }) {
  const { data, loading, error } = useRows("quotes", { trip_id: trip.id });
  const [showDiscarded, setShowDiscarded] = useState(false);
  const quotes = useMemo(() => data.filter((q) => !only || q.type === only), [data, only]);
  const groups = useMemo(() => compareQuotes(quotes, travelerCount(trip), { includeDiscarded: showDiscarded }), [quotes, trip, showDiscarded]);
  const trends = useMemo(() => quoteTrends(quotes.filter((q) => q.status !== "descartada")), [quotes]);
  const [converting, setConverting] = useState<Quote | null>(null);

  if (loading && !data.length) return <Loading />;
  if (error) return <Notice tone="error">{error}</Notice>;
  if (!quotes.length)
    return (
      <EmptyState icon={<WalletCards />} title="Nenhuma cotação registrada">
        Salve resultados das pesquisas ou registre manualmente preços vistos em sites. Cada cotação guarda fonte, URL e data/hora.
      </EmptyState>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">Valores convertidos para {trip.currency} pelo câmbio registrado em cada cotação.</p>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showDiscarded} onChange={(e) => setShowDiscarded(e.target.checked)} /> Mostrar descartadas
        </label>
      </div>
      {groups.map((g) => (
        <Card key={g.type}>
          <CardHeader title={QUOTE_TYPE_LABEL[g.type]} subtitle={g.coverage_note} />
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2">Cotação</th>
                  <th className="px-3 py-2 text-right">Pacote</th>
                  <th className="px-3 py-2 text-right">Por pessoa</th>
                  <th className="px-3 py-2 text-right">Família/grupo</th>
                  <th className="px-3 py-2 text-right">Por {UNIT_LABEL[g.type]}</th>
                  <th className="px-3 py-2">Situação</th>
                  <th className="px-3 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r) => (
                  <QuoteRow key={r.quote.id} r={r} trip={trip} onConvert={() => setConverting(r.quote)} />
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      ))}

      <Card>
        <CardHeader title="Tendência de preços" subtitle="Somente quando há pelo menos 3 consultas da mesma busca em datas diferentes. Não é previsão." />
        <CardBody className="space-y-2">
          {!trends.length && <p className="text-sm text-muted">Use a mesma “chave de comparação” ao registrar cotações repetidas para acompanhar a variação.</p>}
          {trends.map((t) => (
            <div key={t.search_key} className="flex flex-wrap items-center gap-2 text-sm">
              <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">{t.search_key}</code>
              {t.sufficient ? (
                <Badge tone={t.direction === "subindo" ? "red" : t.direction === "caindo" ? "green" : "neutral"}>
                  {t.direction === "subindo" ? <TrendingUp className="h-3 w-3" /> : t.direction === "caindo" ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                  {t.change_pct! >= 0 ? "+" : ""}
                  {t.change_pct}%
                </Badge>
              ) : (
                <Badge>histórico insuficiente</Badge>
              )}
              <span className="text-muted">{t.message}</span>
            </div>
          ))}
        </CardBody>
      </Card>
      {converting && <ConvertDialog quote={converting} trip={trip} onClose={() => setConverting(null)} />}
    </div>
  );
}

function QuoteRow({ r, trip, onConvert }: { r: NormalizedQuote; trip: Trip; onConvert: () => void }) {
  const toast = useToast();
  const q = r.quote;
  const f = r.freshness;
  async function discard() {
    await getRepo().update("quotes", q.id, { status: q.status === "descartada" ? "ativa" : "descartada" });
  }
  async function remove() {
    if (!confirm("Excluir esta cotação?")) return;
    await getRepo().remove("quotes", q.id);
    toast("Cotação excluída.");
  }
  return (
    <tr className="border-t border-line align-top">
      <td className="px-4 py-3">
        <div className="font-medium">{q.title}</div>
        <div className="text-xs text-muted">
          {q.provider_name} · {SOURCE_LABEL[q.source]} · visto em {fmtDateTime(q.captured_at)}
          {q.currency !== trip.currency && ` · ${money(q.total_price, q.currency)} × ${q.fx_rate}`}
        </div>
      </td>
      <td className="px-3 py-3 text-right tabular-nums font-semibold">{money(r.base_total, trip.currency)}</td>
      <td className="px-3 py-3 text-right tabular-nums">{money(r.per_person, trip.currency)}</td>
      <td className="px-3 py-3 text-right tabular-nums">{money(r.per_family, trip.currency)}</td>
      <td className="px-3 py-3 text-right tabular-nums">{money(r.per_unit, trip.currency)}</td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-1">
          <Badge tone={f.expired ? "red" : f.stale ? "amber" : "green"}>{f.label}</Badge>
          {r.is_lowest_registered && <Badge tone="blue">menor entre as registradas</Badge>}
          {q.status === "convertida" && <Badge tone="violet">no orçamento</Badge>}
          {q.status === "descartada" && <Badge>descartada</Badge>}
          {q.source === "demo" && <Badge tone="orange">fictícia</Badge>}
        </div>
        {r.diff_from_lowest > 0 && <div className="mt-1 text-xs text-muted">+{money(r.diff_from_lowest, trip.currency)} vs. menor</div>}
      </td>
      <td className="px-3 py-3">
        <div className="flex justify-end gap-1">
          {q.url && (
            <a href={q.url} target="_blank" rel="noopener noreferrer nofollow" className="rounded-lg p-2 hover:bg-surface-2" aria-label="Abrir oferta no fornecedor (nova aba)">
              <ExtIcon className="h-4 w-4" />
            </a>
          )}
          {q.status !== "convertida" && (
            <Button size="sm" variant="outline" onClick={onConvert} disabled={f.expired} title={f.expired ? "Oferta vencida: consulte de novo" : undefined}>
              Orçamento
            </Button>
          )}
          <Button size="icon" variant="ghost" onClick={discard} aria-label={q.status === "descartada" ? "Reativar" : "Descartar"}>
            <Ban className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={remove} aria-label="Excluir cotação">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function ConvertDialog({ quote, trip, onClose }: { quote: Quote; trip: Trip; onClose: () => void }) {
  const toast = useToast();
  const { data: expenses } = useRows("expenses", { trip_id: trip.id });
  const candidates = expenses.filter((e) => e.category_key === QUOTE_TYPE_CATEGORY[quote.type] && e.status !== "cancelado");
  const [target, setTarget] = useState("novo");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const repo = getRepo();
      let expenseId: string;
      if (target === "novo") {
        expenseId = (await repo.insert("expenses", quoteToExpense(quote))).id;
      } else {
        expenseId = target;
        await repo.update("expenses", target, quotePatchForExpense(quote));
      }
      await repo.update("quotes", quote.id, { status: "convertida", expense_id: expenseId });
      toast("Cotação adicionada ao orçamento como valor COTADO (não reservado, não pago).");
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title="Adicionar ao orçamento" description="A cotação entra como valor cotado. Reserva e pagamento são registrados depois, separadamente.">
      <div className="space-y-4">
        <Field label="Destino no orçamento">
          {(p) => (
            <Select {...p} value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="novo">Criar novo item</option>
              {candidates.map((e) => (
                <option key={e.id} value={e.id}>
                  Atualizar cotado de: {e.description}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} loading={saving}>
            Confirmar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
