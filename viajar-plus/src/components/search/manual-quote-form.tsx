"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { getRepo } from "@/lib/data";
import { fetchFxRate } from "@/lib/fx-client";
import { CURRENCIES } from "@/lib/format";
import { manualQuoteSchema, type ManualQuoteInput } from "@/lib/schemas";
import { travelerCount } from "@/lib/trips/service";
import type { QuoteType, Trip } from "@/lib/types";
import { DETAIL_FIELDS } from "./quote-detail-fields";

type In = z.input<typeof manualQuoteSchema>;

function localNow(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/** Registro manual de um preço visto em site sem API: guarda fonte, URL e data/hora. */
export function ManualQuoteForm({ trip, defaultType = "voo", lockType, onSaved }: { trip: Trip; defaultType?: QuoteType; lockType?: boolean; onSaved?: () => void }) {
  const toast = useToast();
  const nights = Math.max(1, Math.round((Date.parse(trip.end_date) - Date.parse(trip.start_date)) / 86_400_000));
  const [details, setDetails] = useState<Record<string, string>>({});
  const [fxNote, setFxNote] = useState<string | null>(null);
  const { register, handleSubmit, formState, watch, setValue, reset } = useForm<In, unknown, ManualQuoteInput>({
    resolver: zodResolver(manualQuoteSchema),
    defaultValues: {
      type: defaultType,
      title: "",
      provider_name: "",
      url: "",
      total_price: 0,
      currency: trip.currency,
      fx_rate: 1,
      travelers_count: travelerCount(trip),
      units: defaultType === "hospedagem" || defaultType === "carro" ? nights : 1,
      captured_at: localNow(),
      valid_until: "",
      search_key: "",
      notes: "",
    },
  });
  const type = watch("type") as QuoteType;
  const currency = watch("currency") as string;
  const err = formState.errors;

  async function updateFx() {
    try {
      const r = await fetchFxRate(currency, trip.currency);
      setValue("fx_rate", r.rate);
      setFxNote(`1 ${currency} = ${r.rate} ${trip.currency} (${r.source}). Taxa de referência, sem spread/IOF.`);
    } catch (e) {
      setFxNote(e instanceof Error ? e.message : "Câmbio indisponível; informe manualmente.");
    }
  }

  async function onSubmit(v: ManualQuoteInput) {
    try {
      const cleanDetails = Object.fromEntries(Object.entries(details).filter(([, x]) => x !== ""));
      await getRepo().insert("quotes", {
        trip_id: trip.id,
        type: v.type,
        title: v.title,
        provider_name: v.provider_name,
        source: "manual",
        url: v.url,
        total_price: v.total_price,
        currency: v.currency,
        fx_rate: v.currency === trip.currency ? 1 : v.fx_rate,
        travelers_count: v.travelers_count,
        units: v.units,
        captured_at: new Date(v.captured_at).toISOString(),
        valid_until: v.valid_until ? new Date(v.valid_until).toISOString() : null,
        search_key: v.search_key || `${v.type}:${trip.destination}:${trip.start_date}`.toLowerCase(),
        details: cleanDetails,
        status: "ativa",
        expense_id: null,
        notes: v.notes,
      });
      toast("Cotação registrada.");
      reset();
      setDetails({});
      onSaved?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao salvar", "error");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3 md:grid-cols-4" noValidate>
      <Field label="Tipo" error={err.type?.message}>
        {(p) => (
          <Select {...p} {...register("type")} disabled={lockType}>
            <option value="voo">Voo</option>
            <option value="hospedagem">Hospedagem</option>
            <option value="carro">Carro</option>
            <option value="passeio">Passeio</option>
            <option value="outro">Outro</option>
          </Select>
        )}
      </Field>
      <Field label="Descrição" error={err.title?.message} className="md:col-span-3">
        {(p) => <Input {...p} {...register("title")} placeholder="Ex.: SUV 7 lugares, retirada no aeroporto FTE" />}
      </Field>
      <Field label="Fonte / fornecedor" error={err.provider_name?.message}>
        {(p) => <Input {...p} {...register("provider_name")} placeholder="Ex.: Rentalcars" />}
      </Field>
      <Field label="URL da oferta" error={err.url?.message} className="md:col-span-3">
        {(p) => <Input {...p} type="url" inputMode="url" {...register("url")} placeholder="https://…" />}
      </Field>
      <Field label="Preço total" error={err.total_price?.message}>
        {(p) => <Input {...p} type="number" step="0.01" min={0} {...register("total_price")} />}
      </Field>
      <Field label="Moeda" error={err.currency?.message}>
        {(p) => (
          <Select {...p} {...register("currency")}>
            {[trip.currency, ...CURRENCIES.filter((c) => c !== trip.currency)].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={`Câmbio → ${trip.currency}`} error={err.fx_rate?.message} hint={currency === trip.currency ? "Mesma moeda da viagem" : undefined}>
        {(p) => (
          <div className="flex gap-1">
            <Input {...p} type="number" step="0.000001" min={0} {...register("fx_rate")} disabled={currency === trip.currency} />
            {currency !== trip.currency && (
              <Button variant="outline" size="icon" onClick={updateFx} aria-label="Buscar câmbio atual">
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </Field>
      <Field label="Viajantes cobertos" error={err.travelers_count?.message}>
        {(p) => <Input {...p} type="number" min={1} {...register("travelers_count")} />}
      </Field>
      {fxNote && <p className="text-xs text-muted md:col-span-4">{fxNote}</p>}
      <Field label={type === "hospedagem" ? "Noites" : type === "carro" ? "Diárias" : "Unidades"} error={err.units?.message}>
        {(p) => <Input {...p} type="number" min={1} {...register("units")} />}
      </Field>
      <Field label="Visto em (data e hora)" error={err.captured_at?.message}>
        {(p) => <Input {...p} type="datetime-local" {...register("captured_at")} />}
      </Field>
      <Field label="Válido até (se informado)" error={err.valid_until?.message}>
        {(p) => <Input {...p} type="datetime-local" {...register("valid_until")} />}
      </Field>
      <Field label="Chave de comparação" hint="Mesma chave = mesma busca (para tendência)">
        {(p) => <Input {...p} {...register("search_key")} placeholder={`${type}:${trip.destination}`.toLowerCase()} />}
      </Field>

      {DETAIL_FIELDS[type].length > 0 && (
        <fieldset className="grid gap-3 rounded-xl border border-line p-3 md:col-span-4 md:grid-cols-3">
          <legend className="px-1 text-sm font-semibold">Detalhes informados pela fonte</legend>
          {DETAIL_FIELDS[type].map((f) => (
            <Field key={f.key} label={f.label}>
              {(p) =>
                f.kind === "select" ? (
                  <Select {...p} value={details[f.key] ?? ""} onChange={(e) => setDetails((d) => ({ ...d, [f.key]: e.target.value }))}>
                    {(f.options ?? []).map((o) => (
                      <option key={o} value={o}>
                        {o || "não informado"}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    {...p}
                    type={f.kind === "number" ? "number" : "text"}
                    value={details[f.key] ?? ""}
                    onChange={(e) => setDetails((d) => ({ ...d, [f.key]: e.target.value }))}
                  />
                )
              }
            </Field>
          ))}
        </fieldset>
      )}
      <Field label="Observações" className="md:col-span-4">
        {(p) => <Textarea {...p} {...register("notes")} className="min-h-16" />}
      </Field>
      <div className="flex items-center justify-between gap-2 md:col-span-4">
        <Notice tone="info" className="flex-1">
          Registro manual: o preço é o que você viu no site, na data/hora informada. Confirme no fornecedor antes de comprar.
        </Notice>
        <Button type="submit" loading={formState.isSubmitting}>
          Salvar cotação
        </Button>
      </div>
    </form>
  );
}
