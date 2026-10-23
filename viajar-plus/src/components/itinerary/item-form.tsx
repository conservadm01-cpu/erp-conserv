"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";
import { canMarkReserved, parseOpeningHours } from "@/lib/itinerary/conflicts";
import { CURRENCIES, fmtDate } from "@/lib/format";
import type { ItineraryDay, ItineraryItem, Reservation, Trip } from "@/lib/types";

const optNum = z.string().trim().refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= 0), "Número inválido");
const optCoord = (max: number) => z.string().trim().refine((v) => v === "" || (Number.isFinite(Number(v)) && Math.abs(Number(v)) <= max), "Coordenada inválida");

const schema = z
  .object({
    day_id: z.string().min(1, "Escolha o dia"),
    title: z.string().trim().min(2, "Dê um título").max(160),
    kind: z.enum(["passeio", "refeicao", "deslocamento", "hospedagem", "voo", "descanso", "outro"]),
    start_time: z.string().refine((v) => v === "" || /^\d{2}:\d{2}$/.test(v), "Use HH:MM"),
    duration_min: z.string().refine((v) => Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 1440, "Duração entre 0 e 1440 min"),
    address: z.string().max(300),
    lat: optCoord(90),
    lng: optCoord(180),
    cost_estimate: optNum,
    currency: z.string().regex(/^[A-Z]{3}$/),
    travel_min_from_prev: optNum,
    opening_hours: z.string().refine((v) => v.trim() === "" || parseOpeningHours(v) != null, "Use o formato 09:00-18:00"),
    notes: z.string().max(2000),
    booking_status: z.enum(["sugestao", "planejado", "reservado", "concluido"]),
    reservation_id: z.string(),
  })
  .refine((v) => (v.lat === "") === (v.lng === ""), { path: ["lng"], message: "Informe latitude e longitude juntas" });

type FormValues = z.infer<typeof schema>;

export const KIND_LABEL: Record<ItineraryItem["kind"], string> = {
  passeio: "Passeio/atração",
  refeicao: "Refeição",
  deslocamento: "Deslocamento",
  hospedagem: "Hospedagem",
  voo: "Voo",
  descanso: "Descanso",
  outro: "Outro",
};

export const BOOKING_LABEL: Record<ItineraryItem["booking_status"], string> = {
  sugestao: "Sugestão",
  planejado: "Planejado",
  reservado: "Reservado (confirmado)",
  concluido: "Concluído",
};

export type ItemPayload = Omit<ItineraryItem, "id" | "created_at" | "updated_at" | "trip_id" | "position" | "activity_id">;

export function ItemForm({
  trip,
  days,
  reservations,
  initial,
  defaultDayId,
  onSubmit,
  onCancel,
}: {
  trip: Trip;
  days: ItineraryDay[];
  reservations: Reservation[];
  initial?: ItineraryItem | null;
  defaultDayId?: string;
  onSubmit: (v: ItemPayload) => Promise<void>;
  onCancel: () => void;
}) {
  const [geoMsg, setGeoMsg] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const { register, handleSubmit, formState, setValue, watch, setError } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      day_id: initial?.day_id ?? defaultDayId ?? days[0]?.id ?? "",
      title: initial?.title ?? "",
      kind: initial?.kind ?? "passeio",
      start_time: initial?.start_time ?? "",
      duration_min: String(initial?.duration_min ?? 60),
      address: initial?.address ?? "",
      lat: initial?.lat != null ? String(initial.lat) : "",
      lng: initial?.lng != null ? String(initial.lng) : "",
      cost_estimate: initial?.cost_estimate ? String(initial.cost_estimate) : "",
      currency: initial?.currency ?? trip.currency,
      travel_min_from_prev: initial?.travel_min_from_prev != null ? String(initial.travel_min_from_prev) : "",
      opening_hours: initial?.opening_hours ?? "",
      notes: initial?.notes ?? "",
      booking_status: initial?.booking_status ?? "planejado",
      reservation_id: initial?.reservation_id ?? "",
    },
  });
  const e = formState.errors;
  const reservationId = watch("reservation_id");
  const status = watch("booking_status");
  const confirmed = reservations.filter((r) => r.status === "confirmada");
  const reservedAllowed = canMarkReserved({ reservation_id: reservationId || null }, reservations);

  async function geocode() {
    const q = [watch("address"), trip.destination, trip.destination_country].filter(Boolean).join(", ");
    if (!watch("address").trim()) {
      setGeoMsg({ tone: "error", text: "Preencha o endereço primeiro." });
      return;
    }
    setGeoLoading(true);
    setGeoMsg(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const json = (await res.json().catch(() => ({}))) as { results?: { lat: number; lng: number; display_name: string }[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Geocodificação indisponível no momento.");
      const r = json.results?.[0];
      if (!r) throw new Error("Endereço não encontrado. Informe as coordenadas manualmente se quiser vê-lo no mapa.");
      setValue("lat", String(r.lat), { shouldDirty: true });
      setValue("lng", String(r.lng), { shouldDirty: true });
      setGeoMsg({ tone: "info", text: `Localizado: ${r.display_name} (dados © OpenStreetMap)` });
    } catch (err) {
      setGeoMsg({ tone: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setGeoLoading(false);
    }
  }

  const submit = handleSubmit(async (v) => {
    if (v.booking_status === "reservado" && !canMarkReserved({ reservation_id: v.reservation_id || null }, reservations)) {
      setError("booking_status", { message: "Para marcar como reservado, vincule uma reserva com status confirmada." });
      return;
    }
    await onSubmit({
      day_id: v.day_id,
      title: v.title.trim(),
      kind: v.kind,
      start_time: v.start_time || null,
      duration_min: Number(v.duration_min),
      address: v.address.trim(),
      lat: v.lat === "" ? null : Number(v.lat),
      lng: v.lng === "" ? null : Number(v.lng),
      cost_estimate: v.cost_estimate === "" ? 0 : Number(v.cost_estimate),
      currency: v.currency,
      travel_min_from_prev: v.travel_min_from_prev === "" ? null : Number(v.travel_min_from_prev),
      opening_hours: v.opening_hours.trim(),
      notes: v.notes,
      booking_status: v.booking_status,
      reservation_id: v.reservation_id || null,
    });
  });

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
      <Field label="Título" error={e.title?.message} className="sm:col-span-2">
        {(p) => <Input {...p} {...register("title")} placeholder="Ex.: Glaciar Perito Moreno — passarelas" />}
      </Field>
      <Field label="Dia" error={e.day_id?.message}>
        {(p) => (
          <Select {...p} {...register("day_id")}>
            {days.map((d) => (
              <option key={d.id} value={d.id}>
                {fmtDate(d.date, { weekday: "short", day: "2-digit", month: "short" })} — {d.title}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Tipo">
        {(p) => (
          <Select {...p} {...register("kind")}>
            {Object.entries(KIND_LABEL).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Início" error={e.start_time?.message} hint="Opcional">
        {(p) => <Input {...p} type="time" {...register("start_time")} />}
      </Field>
      <Field label="Duração (min)" error={e.duration_min?.message}>
        {(p) => <Input {...p} type="number" min={0} step={5} inputMode="numeric" {...register("duration_min")} />}
      </Field>
      <Field label="Endereço / local" className="sm:col-span-2">
        {(p) => (
          <div className="flex gap-2">
            <Input {...p} {...register("address")} placeholder="Ex.: Av. del Libertador 1000, El Calafate" />
            <Button variant="outline" onClick={geocode} loading={geoLoading} aria-label="Localizar endereço no mapa">
              <MapPin className="h-4 w-4" aria-hidden /> Localizar
            </Button>
          </div>
        )}
      </Field>
      {geoMsg && <Notice tone={geoMsg.tone} className="sm:col-span-2">{geoMsg.text}</Notice>}
      <Field label="Latitude" error={e.lat?.message}>
        {(p) => <Input {...p} inputMode="decimal" {...register("lat")} placeholder="-50.3379" />}
      </Field>
      <Field label="Longitude" error={e.lng?.message}>
        {(p) => <Input {...p} inputMode="decimal" {...register("lng")} placeholder="-72.2648" />}
      </Field>
      <Field label="Deslocamento desde o item anterior (min)" error={e.travel_min_from_prev?.message} hint="Vazio = estimar pela distância quando houver coordenadas">
        {(p) => <Input {...p} type="number" min={0} inputMode="numeric" {...register("travel_min_from_prev")} />}
      </Field>
      <Field label="Horário de funcionamento" error={e.opening_hours?.message} hint="Ex.: 09:00-18:00 (confirme na fonte oficial)">
        {(p) => <Input {...p} {...register("opening_hours")} placeholder="09:00-18:00" />}
      </Field>
      <Field label="Custo estimado" error={e.cost_estimate?.message} hint="Estimativa sua; não é cotação">
        {(p) => <Input {...p} type="number" min={0} step="0.01" inputMode="decimal" {...register("cost_estimate")} />}
      </Field>
      <Field label="Moeda">
        {(p) => (
          <Select {...p} {...register("currency")}>
            {[...new Set([trip.currency, ...CURRENCIES])].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Reserva vinculada" hint={confirmed.length ? undefined : "Nenhuma reserva confirmada ainda — cadastre em Reservas."}>
        {(p) => (
          <Select {...p} {...register("reservation_id")}>
            <option value="">Nenhuma</option>
            {reservations.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title} ({r.status})
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Status" error={e.booking_status?.message}>
        {(p) => (
          <Select {...p} {...register("booking_status")}>
            {Object.entries(BOOKING_LABEL).map(([k, l]) => (
              <option key={k} value={k} disabled={k === "reservado" && !reservedAllowed}>
                {l}
                {k === "reservado" && !reservedAllowed ? " — exige reserva confirmada" : ""}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {status === "reservado" && !reservedAllowed && (
        <Notice tone="warn" className="sm:col-span-2">
          Uma atração só aparece como reservada quando há uma reserva confirmada pelo fornecedor vinculada a ela.
        </Notice>
      )}
      <Field label="Observações" className="sm:col-span-2">
        {(p) => <Textarea {...p} {...register("notes")} rows={3} />}
      </Field>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" loading={formState.isSubmitting}>Salvar item</Button>
      </div>
    </form>
  );
}
