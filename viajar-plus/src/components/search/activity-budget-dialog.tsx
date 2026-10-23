"use client";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { quoteFromUnit } from "@/lib/budget/calc";
import { getRepo } from "@/lib/data";
import { fetchFxRate } from "@/lib/fx-client";
import { CURRENCIES, money } from "@/lib/format";
import { travelerCount } from "@/lib/trips/service";
import type { Activity, Trip } from "@/lib/types";

/** Leva um passeio ao orçamento como PREVISTO (estimativa) ou COTADO (preço do fornecedor). Nunca como pago. */
export function ActivityBudgetDialog({ trip, activity, onClose }: { trip: Trip; activity: Activity; onClose: () => void }) {
  const toast = useToast();
  const [perPerson, setPerPerson] = useState(String(activity.price_per_person ?? ""));
  const [group, setGroup] = useState(String(activity.price_group ?? ""));
  const [people, setPeople] = useState(String(travelerCount(trip)));
  const [currency, setCurrency] = useState(activity.currency || trip.currency);
  const [fx, setFx] = useState("1");
  const [kind, setKind] = useState<"previsto" | "cotado">(activity.price_per_person != null || activity.price_group != null ? "cotado" : "previsto");
  const [saving, setSaving] = useState(false);
  const pp = Number(perPerson) || 0;
  const grp = Number(group) || 0;
  const n = Math.max(1, Number(people) || 1);
  const rate = currency === trip.currency ? 1 : Number(fx) || 0;
  const totalOrig = grp > 0 ? grp : pp * n;
  const totalBase = quoteFromUnit(1, totalOrig, 0, rate);

  async function save() {
    if (totalBase <= 0) {
      toast("Informe o preço por pessoa ou do grupo.", "error");
      return;
    }
    setSaving(true);
    try {
      await getRepo().insert("expenses", {
        trip_id: trip.id,
        category_key: "passeios",
        description: activity.name,
        supplier: activity.provider_name,
        quantity: grp > 0 ? 1 : n,
        unit_price: grp > 0 ? grp : pp,
        original_currency: currency,
        fx_rate: rate,
        fees: 0,
        planned_amount: kind === "previsto" ? totalBase : 0,
        quoted_amount: kind === "cotado" ? totalBase : 0,
        reserved_amount: 0,
        due_date: null,
        responsible_traveler_id: null,
        status: kind === "cotado" ? "cotado" : "previsto",
        receipt_document_id: null,
        notes: [activity.url ? `Fonte: ${activity.url}` : "", activity.cancellation_policy ? `Cancelamento: ${activity.cancellation_policy}` : ""].filter(Boolean).join(" "),
        split_mode: "todos",
        split: {},
        quote_id: null,
        reservation_id: null,
        diary_entry_id: null,
        incurred_on: null,
      });
      toast(`Adicionado ao orçamento como ${kind}.`);
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title="Adicionar passeio ao orçamento" description={activity.name}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Preço por pessoa">{(p) => <Input {...p} type="number" min={0} step="0.01" value={perPerson} onChange={(e) => setPerPerson(e.target.value)} />}</Field>
        <Field label="Participantes">{(p) => <Input {...p} type="number" min={1} value={people} onChange={(e) => setPeople(e.target.value)} />}</Field>
        <Field label="Ou preço fechado do grupo" hint="Se preenchido, substitui o cálculo por pessoa">
          {(p) => <Input {...p} type="number" min={0} step="0.01" value={group} onChange={(e) => setGroup(e.target.value)} />}
        </Field>
        <Field label="Moeda">
          {(p) => (
            <Select {...p} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {[trip.currency, ...CURRENCIES.filter((c) => c !== trip.currency)].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          )}
        </Field>
        {currency !== trip.currency && (
          <Field label={`Câmbio ${currency} → ${trip.currency}`}>
            {(p) => (
              <div className="flex gap-1">
                <Input {...p} type="number" step="0.000001" value={fx} onChange={(e) => setFx(e.target.value)} />
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Buscar câmbio"
                  onClick={async () => {
                    try {
                      setFx(String((await fetchFxRate(currency, trip.currency)).rate));
                    } catch (e) {
                      toast(e instanceof Error ? e.message : "Câmbio indisponível", "error");
                    }
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            )}
          </Field>
        )}
        <Field label="Entra como">
          {(p) => (
            <Select {...p} value={kind} onChange={(e) => setKind(e.target.value as "previsto" | "cotado")}>
              <option value="previsto">Previsto (minha estimativa)</option>
              <option value="cotado">Cotado (preço informado pelo fornecedor)</option>
            </Select>
          )}
        </Field>
        <div className="rounded-xl bg-surface-2 p-3 text-sm sm:col-span-2">
          Total: <strong>{money(totalBase, trip.currency)}</strong>
          {currency !== trip.currency && <span className="text-muted"> ({money(totalOrig, currency)})</span>}
        </div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} loading={saving}>
            Adicionar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
