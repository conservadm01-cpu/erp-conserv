"use client";
import { useState } from "react";
import { Compass, Trash2, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ExternalLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { EmptyState, Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { getRepo } from "@/lib/data";
import { useRows } from "@/lib/data/hooks";
import { fmtDateTime, minutesLabel, money } from "@/lib/format";
import { activityLinks } from "@/lib/providers/links";
import type { SearchApiResponse } from "@/lib/providers/search-response";
import type { ActivityResult } from "@/lib/providers/types";
import { postSearch } from "@/lib/search/client";
import type { Activity, Trip } from "@/lib/types";
import { ActivityBudgetDialog } from "./activity-budget-dialog";
import { AddToItineraryButton } from "./add-to-itinerary";
import { ExternalLinks, SourceInfo } from "./source-info";
import { useTripCoords } from "./use-trip-coords";

const CAT_LABEL: Record<string, string> = {
  atracao: "Atração", parque: "Parque", barco: "Barco", museu: "Museu", trilha: "Trilha", guia: "Guia", familia: "Família",
  restaurante: "Restaurante", bar: "Bar", cafe: "Café", culinaria: "Culinária local", religioso: "Religioso", mirante: "Mirante", outro: "Outro",
};

export function ActivitySearch({ trip }: { trip: Trip }) {
  const toast = useToast();
  const { coords, locate } = useTripCoords(trip);
  const [date, setDate] = useState(trip.start_date);
  const [data, setData] = useState<SearchApiResponse<ActivityResult> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    setLoading(true);
    setError(null);
    try {
      const at = coords ?? (await locate());
      if (!at) throw new Error("Destino sem localização no mapa.");
      setData(await postSearch<ActivityResult>("/api/search/activities", { destination: trip.destination, lat: at.lat, lng: at.lng, date, radius_km: 20 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function save(a: ActivityResult) {
    try {
      await getRepo().insert("activities", {
        trip_id: trip.id,
        name: a.name,
        category: "atracao",
        description: a.description,
        price_per_person: a.price_per_person,
        price_group: a.price_group,
        currency: a.currency || trip.currency,
        duration_min: a.duration_min,
        min_age: a.min_age,
        accessibility: a.accessibility,
        meeting_point: a.meeting_point,
        cancellation_policy: a.cancellation_policy,
        provider_name: a.provider_name,
        url: a.url,
        lat: a.lat,
        lng: a.lng,
        opening_hours: "",
        free_entry: a.free_entry,
        instagrammable: false,
        source: a.provider.startsWith("Mock") ? "demo" : "api",
        source_ref: a.id,
      });
      toast("Passeio salvo.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro", "error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Data">{(p) => <Input {...p} type="date" value={date} min={trip.start_date} max={trip.end_date} onChange={(e) => setDate(e.target.value)} />}</Field>
        <Button onClick={search} loading={loading}>
          <Compass className="h-4 w-4" aria-hidden /> Buscar passeios com preço
        </Button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {data && <SourceInfo data={data} />}
      <div className="grid gap-3 md:grid-cols-2">
        {data?.results.map((a) => (
          <Card key={a.id}>
            <CardBody className="space-y-2">
              <h3 className="font-semibold">{a.name}</h3>
              <p className="line-clamp-3 text-sm text-muted">{a.description}</p>
              <div className="text-sm">
                {a.price_per_person != null ? <strong>{money(a.price_per_person, a.currency)} / pessoa</strong> : "Preço por pessoa não informado"}
                {a.price_group != null && <> · {money(a.price_group, a.currency)} / grupo</>}
              </div>
              <div className="text-xs text-muted">
                Duração: {minutesLabel(a.duration_min)} · Idade mínima: {a.min_age ?? "não informada"} · Acessibilidade: {a.accessibility || "não informada"} · Saída: {a.meeting_point || "não informada"} ·
                Cancelamento: {a.cancellation_policy || "não informado"} · Fornecedor: {a.provider_name} · consultado em {fmtDateTime(a.queried_at)}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => save(a)}>
                  Salvar
                </Button>
                {a.url && <ExternalLink href={a.url}>Ver/reservar no fornecedor</ExternalLink>}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
      <ExternalLinks links={data?.links ?? activityLinks(trip.destination, date)} />
    </div>
  );
}

export function SavedActivities({ trip }: { trip: Trip }) {
  const { data } = useRows("activities", { trip_id: trip.id });
  const [budgeting, setBudgeting] = useState<Activity | null>(null);
  const toast = useToast();
  if (!data.length)
    return (
      <EmptyState icon={<Compass />} title="Nenhum passeio ou lugar salvo">
        Salve passeios das pesquisas ou lugares do guia para levar ao roteiro e ao orçamento.
      </EmptyState>
    );
  return (
    <Card>
      <CardHeader title="Passeios e lugares salvos" subtitle={`${data.length} item(ns)`} />
      <CardBody className="divide-y divide-line p-0">
        {data.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{a.name}</span>
                <Badge>{CAT_LABEL[a.category] ?? a.category}</Badge>
                {a.instagrammable && <Badge tone="orange">instagramável</Badge>}
                {a.free_entry === true && <Badge tone="green">sem ingresso*</Badge>}
                {a.source === "demo" && <Badge tone="red">fictício</Badge>}
              </div>
              <div className="text-xs text-muted">
                {a.price_per_person != null ? `${money(a.price_per_person, a.currency)} / pessoa · ` : ""}
                {a.provider_name}
                {a.opening_hours && ` · ${a.opening_hours}`}
                {a.free_entry === true && " · *transporte, estacionamento e taxas de parque podem ser cobrados"}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <AddToItineraryButton
                trip={trip}
                draft={{
                  title: a.name,
                  kind: ["restaurante", "bar", "cafe", "culinaria"].includes(a.category) ? "refeicao" : "passeio",
                  duration_min: a.duration_min ?? 90,
                  address: a.meeting_point || a.name,
                  lat: a.lat,
                  lng: a.lng,
                  opening_hours: a.opening_hours,
                  activity_id: a.id,
                }}
              />
              <Button size="sm" variant="outline" onClick={() => setBudgeting(a)}>
                <Wallet className="h-4 w-4" aria-hidden /> Orçamento
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Remover ${a.name}`}
                onClick={async () => {
                  await getRepo().remove("activities", a.id);
                  toast("Removido.");
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardBody>
      {budgeting && <ActivityBudgetDialog trip={trip} activity={budgeting} onClose={() => setBudgeting(null)} />}
    </Card>
  );
}
