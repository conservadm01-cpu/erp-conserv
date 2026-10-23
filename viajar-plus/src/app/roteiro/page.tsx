"use client";
import { useMemo, useState } from "react";
import { CalendarDays, Plus, Sparkles } from "lucide-react";
import { RequireTrip } from "@/components/layout/require-trip";
import { PageHeader, Loading, Notice, EmptyState } from "@/components/ui/states";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Modal } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { MapView } from "@/components/map";
import { DayBoard, type Groups } from "@/components/itinerary/day-board";
import { ItemForm, type ItemPayload } from "@/components/itinerary/item-form";
import { getRepo } from "@/lib/data";
import { useRows } from "@/lib/data/hooks";
import { analyzeItinerary, fitTimes } from "@/lib/itinerary/conflicts";
import { fmtDate } from "@/lib/format";
import type { Activity, ID, ItineraryItem, Trip } from "@/lib/types";

export default function RoteiroPage() {
  return <RequireTrip>{(trip) => <Roteiro trip={trip} />}</RequireTrip>;
}

function Roteiro({ trip }: { trip: Trip }) {
  const toast = useToast();
  const days = useRows("itinerary_days", { trip_id: trip.id });
  const items = useRows("itinerary_items", { trip_id: trip.id });
  const reservations = useRows("reservations", { trip_id: trip.id });
  const activities = useRows("activities", { trip_id: trip.id });
  const [editing, setEditing] = useState<{ item: ItineraryItem | null; dayId?: ID } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const sortedDays = useMemo(() => [...days.data].sort((a, b) => a.date.localeCompare(b.date)), [days.data]);
  const issues = useMemo(
    () => analyzeItinerary(sortedDays, items.data, { pace: trip.pace, reservations: reservations.data }),
    [sortedDays, items.data, trip.pace, reservations.data],
  );
  const markers = useMemo(
    () =>
      items.data
        .filter((i) => i.lat != null && i.lng != null)
        .map((i) => {
          const d = sortedDays.find((x) => x.id === i.day_id);
          return { id: i.id, lat: i.lat!, lng: i.lng!, title: i.title, subtitle: d ? `${fmtDate(d.date, { day: "2-digit", month: "short" })}${i.start_time ? ` · ${i.start_time}` : ""}` : undefined };
        }),
    [items.data, sortedDays],
  );
  const planned = new Set(items.data.map((i) => i.activity_id).filter(Boolean));
  const ideas = activities.data.filter((a) => !planned.has(a.id));

  async function persist(groups: Groups) {
    const repo = getRepo();
    const byId = new Map(items.data.map((i) => [i.id, i]));
    try {
      for (const [dayId, list] of Object.entries(groups)) {
        for (let pos = 0; pos < list.length; pos++) {
          const cur = byId.get(list[pos].id);
          if (cur && (cur.position !== pos || cur.day_id !== dayId)) await repo.update("itinerary_items", cur.id, { position: pos, day_id: dayId });
        }
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao reorganizar", "error");
      items.reload();
    }
  }

  async function save(v: ItemPayload) {
    const repo = getRepo();
    try {
      if (editing?.item) {
        const movedDay = editing.item.day_id !== v.day_id;
        await repo.update("itinerary_items", editing.item.id, {
          ...v,
          ...(movedDay ? { position: items.data.filter((i) => i.day_id === v.day_id).length } : {}),
        });
        toast("Item atualizado");
      } else {
        await repo.insert("itinerary_items", {
          ...v,
          trip_id: trip.id,
          activity_id: null,
          position: items.data.filter((i) => i.day_id === v.day_id).length,
        });
        toast("Item adicionado ao roteiro");
      }
      setEditing(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao salvar", "error");
    }
  }

  async function remove(item: ItineraryItem) {
    if (!confirm(`Excluir "${item.title}" do roteiro?`)) return;
    try {
      await getRepo().remove("itinerary_items", item.id);
      toast("Item excluído");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao excluir", "error");
    }
  }

  async function fit(dayId: ID) {
    const list = items.data.filter((i) => i.day_id === dayId);
    if (!list.length) return;
    try {
      for (const r of fitTimes(list)) await getRepo().update("itinerary_items", r.id, { start_time: r.start_time, travel_min_from_prev: r.travel_min_from_prev });
      toast("Horários encaixados em sequência — revise antes de confirmar com fornecedores", "info");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao encaixar horários", "error");
    }
  }

  async function addIdea(a: Activity, dayId: ID) {
    try {
      await getRepo().insert("itinerary_items", {
        trip_id: trip.id,
        day_id: dayId,
        title: a.name,
        kind: ["restaurante", "bar", "cafe", "culinaria"].includes(a.category) ? "refeicao" : "passeio",
        start_time: null,
        duration_min: a.duration_min ?? 90,
        address: a.meeting_point,
        lat: a.lat,
        lng: a.lng,
        cost_estimate: a.price_per_person != null ? a.price_per_person * (trip.adults + trip.children) : 0,
        currency: a.currency || trip.currency,
        travel_min_from_prev: null,
        opening_hours: /^\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}$/.test(a.opening_hours) ? a.opening_hours : "",
        notes: [a.description, a.free_entry ? "Sem ingresso (transporte e taxas não incluídos)." : ""].filter(Boolean).join(" "),
        booking_status: "sugestao",
        reservation_id: null,
        activity_id: a.id,
        position: items.data.filter((i) => i.day_id === dayId).length,
      });
      toast(`"${a.name}" adicionado como sugestão`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao adicionar", "error");
    }
  }

  const errors = issues.filter((i) => i.severity === "erro").length;
  const warnings = issues.length - errors;
  const loading = days.loading && !days.data.length;

  return (
    <>
      <PageHeader
        eyebrow={trip.destination}
        title="Roteiro inteligente"
        description="Organize cada dia, arraste atividades entre dias e veja conflitos de horário, deslocamentos e dias cheios."
        actions={
          <Button onClick={() => setEditing({ item: null, dayId: sortedDays[0]?.id })} disabled={!sortedDays.length}>
            <Plus className="h-4 w-4" aria-hidden /> Nova atividade
          </Button>
        }
      />
      {(days.error || items.error) && <Notice tone="error" className="mb-4">{days.error ?? items.error}</Notice>}
      {loading ? (
        <Loading rows={4} />
      ) : !sortedDays.length ? (
        <EmptyState icon={<CalendarDays />} title="Sem dias no roteiro" action={<LinkButton href={`/viagens/${trip.id}`}>Revisar datas da viagem</LinkButton>}>
          Os dias são criados a partir das datas de ida e volta da viagem.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {issues.length > 0 ? (
            <Notice tone={errors ? "error" : "warn"} title={`${errors ? `${errors} conflito(s)` : ""}${errors && warnings ? " e " : ""}${warnings ? `${warnings} alerta(s)` : ""} no roteiro`}>
              Os itens afetados estão destacados. As sugestões são indicativas: confirme horários e distâncias com as fontes oficiais.
            </Notice>
          ) : items.data.length ? (
            <Notice tone="success">Nenhum conflito encontrado com os dados disponíveis.</Notice>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
            <DayBoard
              days={sortedDays}
              items={items.data}
              issues={issues}
              onPersist={persist}
              onEdit={(item) => setEditing({ item })}
              onDelete={remove}
              onAdd={(dayId) => setEditing({ item: null, dayId })}
              onFitTimes={fit}
            />
            <div className="space-y-6">
              <Card>
                <CardHeader title="Mapa do roteiro" subtitle={markers.length ? `${markers.length} local(is) com coordenadas` : "Localize endereços nos itens para vê-los aqui"} />
                <CardBody>
                  <MapView
                    markers={markers}
                    center={trip.destination_lat != null && trip.destination_lng != null ? [trip.destination_lat, trip.destination_lng] : undefined}
                    zoom={9}
                    height={320}
                    onSelect={(id: string) => setSelected(id)}
                  />
                  {selected && (
                    <p className="mt-2 text-sm">
                      Selecionado: <strong>{items.data.find((i) => i.id === selected)?.title}</strong>{" "}
                      <button className="text-accent underline" onClick={() => setEditing({ item: items.data.find((i) => i.id === selected) ?? null })}>
                        editar
                      </button>
                    </p>
                  )}
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Ideias salvas" subtitle="Passeios e lugares salvos nas pesquisas" />
                <CardBody>
                  {!ideas.length ? (
                    <p className="text-sm text-muted">
                      <Sparkles className="mr-1 inline h-4 w-4 text-sunset-500" aria-hidden />
                      Salve passeios, restaurantes e mirantes em <a href="/passeios" className="text-accent underline">Passeios</a> ou{" "}
                      <a href="/pesquisar" className="text-accent underline">Pesquisar</a> para encaixá-los aqui.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {ideas.map((a) => (
                        <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-2 text-sm">
                          <span className="min-w-0 flex-1 truncate font-medium">{a.name}</span>
                          <label className="sr-only" htmlFor={`idea-${a.id}`}>Dia para {a.name}</label>
                          <select
                            id={`idea-${a.id}`}
                            className="h-8 rounded-lg border border-line bg-surface px-1 text-xs"
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) void addIdea(a, e.target.value);
                              e.target.value = "";
                            }}
                          >
                            <option value="">Adicionar em…</option>
                            {sortedDays.map((d) => (
                              <option key={d.id} value={d.id}>{fmtDate(d.date, { day: "2-digit", month: "short" })}</option>
                            ))}
                          </select>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>
            </div>
          </div>
        </div>
      )}

      <Modal open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={editing?.item ? "Editar atividade" : "Nova atividade"} size="lg">
        {editing && (
          <ItemForm
            trip={trip}
            days={sortedDays}
            reservations={reservations.data}
            initial={editing.item}
            defaultDayId={editing.dayId}
            onSubmit={save}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </>
  );
}
