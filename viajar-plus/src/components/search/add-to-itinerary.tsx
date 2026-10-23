"use client";
import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { getRepo } from "@/lib/data";
import { useRows } from "@/lib/data/hooks";
import { fmtDate } from "@/lib/format";
import type { ItineraryItemKind, Trip } from "@/lib/types";

export interface ItineraryDraft {
  title: string;
  kind: ItineraryItemKind;
  duration_min: number;
  address: string;
  lat: number | null;
  lng: number | null;
  cost_estimate?: number;
  opening_hours?: string;
  notes?: string;
  activity_id?: string | null;
}

/** Adiciona ao roteiro como SUGESTÃO — nunca como reservado. */
export function AddToItineraryButton({ trip, draft, size = "sm" }: { trip: Trip; draft: ItineraryDraft; size?: "sm" | "md" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size={size} onClick={() => setOpen(true)}>
        <CalendarPlus className="h-4 w-4" aria-hidden /> Roteiro
      </Button>
      {open && <AddToItineraryDialog trip={trip} draft={draft} open={open} onOpenChange={setOpen} />}
    </>
  );
}

function AddToItineraryDialog({ trip, draft, open, onOpenChange }: { trip: Trip; draft: ItineraryDraft; open: boolean; onOpenChange: (v: boolean) => void }) {
  const toast = useToast();
  const { data: days } = useRows("itinerary_days", { trip_id: trip.id });
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const [dayId, setDayId] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(String(draft.duration_min || 60));
  const [notes, setNotes] = useState(draft.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const day = dayId || sorted[0]?.id;
    if (!day) return;
    setSaving(true);
    try {
      const repo = getRepo();
      const existing = await repo.list("itinerary_items", { trip_id: trip.id, day_id: day });
      await repo.insert("itinerary_items", {
        trip_id: trip.id,
        day_id: day,
        title: draft.title,
        kind: draft.kind,
        start_time: time || null,
        duration_min: Math.max(5, Number(duration) || 60),
        address: draft.address,
        lat: draft.lat,
        lng: draft.lng,
        cost_estimate: draft.cost_estimate ?? 0,
        currency: trip.currency,
        travel_min_from_prev: null,
        opening_hours: draft.opening_hours ?? "",
        notes,
        booking_status: "sugestao",
        reservation_id: null,
        activity_id: draft.activity_id ?? null,
        position: existing.length,
      });
      toast("Adicionado ao roteiro como sugestão.");
      onOpenChange(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao salvar", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Adicionar ao roteiro" description={`${draft.title} entra como sugestão; marque como reservado só após confirmar com o fornecedor.`}>
      {!sorted.length ? (
        <p className="text-sm text-muted">A viagem ainda não tem dias no roteiro. Ajuste as datas da viagem.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Dia" className="sm:col-span-3">
            {(p) => (
              <Select {...p} value={dayId || sorted[0].id} onChange={(e) => setDayId(e.target.value)}>
                {sorted.map((d) => (
                  <option key={d.id} value={d.id}>
                    {fmtDate(d.date, { weekday: "long", day: "2-digit", month: "short" })} — {d.title}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Horário (opcional)">{(p) => <Input {...p} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}</Field>
          <Field label="Duração (min)">{(p) => <Input {...p} type="number" min={5} value={duration} onChange={(e) => setDuration(e.target.value)} />}</Field>
          <Field label="Observações" className="sm:col-span-3">
            {(p) => <Textarea {...p} value={notes} onChange={(e) => setNotes(e.target.value)} />}
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={save} loading={saving}>
              Adicionar
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
