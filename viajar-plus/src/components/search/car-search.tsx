"use client";
import { useMemo, useState } from "react";
import { Car } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";
import { useRows } from "@/lib/data/hooks";
import { carLinks } from "@/lib/providers/links";
import type { SearchApiResponse } from "@/lib/providers/search-response";
import { postSearch } from "@/lib/search/client";
import { travelerCount } from "@/lib/trips/service";
import type { RentalOption, Trip } from "@/lib/types";
import { ExternalLinks, SourceInfo } from "./source-info";

export function CarSearch({ trip }: { trip: Trip }) {
  const [f, setF] = useState({
    pickup_place: `Aeroporto de ${trip.destination}`,
    dropoff_place: "",
    pickup_date: trip.start_date,
    pickup_time: "15:00",
    dropoff_date: trip.end_date,
    dropoff_time: "10:00",
    category: "",
    transmission: "qualquer",
    passengers: travelerCount(trip),
    bags: travelerCount(trip),
  });
  const [data, setData] = useState<SearchApiResponse<RentalOption> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      setData(await postSearch<RentalOption>("/api/search/cars", f));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardBody>
          <form onSubmit={search} className="grid gap-3 md:grid-cols-4">
            <Field label="Retirada (aeroporto ou endereço)" className="md:col-span-2">{(p) => <Input {...p} value={f.pickup_place} onChange={(e) => set("pickup_place", e.target.value)} required />}</Field>
            <Field label="Devolução (se diferente)" className="md:col-span-2">{(p) => <Input {...p} value={f.dropoff_place} onChange={(e) => set("dropoff_place", e.target.value)} />}</Field>
            <Field label="Data de retirada">{(p) => <Input {...p} type="date" value={f.pickup_date} onChange={(e) => set("pickup_date", e.target.value)} />}</Field>
            <Field label="Hora">{(p) => <Input {...p} type="time" value={f.pickup_time} onChange={(e) => set("pickup_time", e.target.value)} />}</Field>
            <Field label="Data de devolução">{(p) => <Input {...p} type="date" value={f.dropoff_date} onChange={(e) => set("dropoff_date", e.target.value)} />}</Field>
            <Field label="Hora">{(p) => <Input {...p} type="time" value={f.dropoff_time} onChange={(e) => set("dropoff_time", e.target.value)} />}</Field>
            <Field label="Categoria">{(p) => <Input {...p} value={f.category} placeholder="SUV, minivan…" onChange={(e) => set("category", e.target.value)} />}</Field>
            <Field label="Câmbio">
              {(p) => (
                <Select {...p} value={f.transmission} onChange={(e) => set("transmission", e.target.value)}>
                  <option value="qualquer">Qualquer</option>
                  <option value="manual">Manual</option>
                  <option value="automatico">Automático</option>
                </Select>
              )}
            </Field>
            <Field label="Passageiros">{(p) => <Input {...p} type="number" min={1} value={f.passengers} onChange={(e) => set("passengers", Number(e.target.value))} />}</Field>
            <Field label="Malas">{(p) => <Input {...p} type="number" min={0} value={f.bags} onChange={(e) => set("bags", Number(e.target.value))} />}</Field>
            <div className="flex justify-end md:col-span-4">
              <Button type="submit" loading={loading}>
                <Car className="h-4 w-4" aria-hidden /> Pesquisar carros
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
      {error && <Notice tone="error">{error}</Notice>}
      {data && <SourceInfo data={data} />}
      <ExternalLinks links={data?.links ?? carLinks(f)} />
      <Notice tone="info" title="Antes de reservar, confira">
        Capacidade real de passageiros <strong>e</strong> malas (um carro de 7 lugares costuma ter pouco porta-malas com todos os bancos), cobertura e franquia do seguro, caução no cartão,
        política de combustível, quilometragem, motorista adicional, travessia de fronteira e exigências de habilitação (como a Permissão Internacional para Dirigir).
      </Notice>
    </div>
  );
}

/** Confere a capacidade informada nas cotações de carro contra o grupo da viagem. */
export function CarCapacityCheck({ trip }: { trip: Trip }) {
  const { data } = useRows("quotes", { trip_id: trip.id });
  const cars = useMemo(() => data.filter((q) => q.type === "carro" && q.status !== "descartada"), [data]);
  const people = travelerCount(trip);
  if (!cars.length) return null;
  return (
    <Card>
      <CardHeader title="Capacidade x grupo" subtitle={`${people} viajante(s). Baseado no que você registrou de cada cotação.`} />
      <CardBody className="space-y-2">
        {cars.map((q) => {
          const seats = Number((q.details as Record<string, unknown>).passageiros) || null;
          const bags = Number((q.details as Record<string, unknown>).malas) || null;
          return (
            <div key={q.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{q.title}</span>
              {seats == null ? <Badge>passageiros não informados</Badge> : seats >= people ? <Badge tone="green">{seats} lugares — cabe o grupo</Badge> : <Badge tone="red">{seats} lugares — não cabe {people}</Badge>}
              {bags == null ? <Badge>malas não informadas</Badge> : <Badge tone={bags >= people ? "green" : "amber"}>{bags} malas</Badge>}
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
