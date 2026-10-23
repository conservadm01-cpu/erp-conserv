"use client";
import { useState } from "react";
import { BedDouble, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ExternalLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { EmptyState, Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { getRepo } from "@/lib/data";
import { fetchFxRate } from "@/lib/fx-client";
import { fmtDateTime, money } from "@/lib/format";
import { lodgingLinks } from "@/lib/providers/links";
import type { SearchApiResponse } from "@/lib/providers/search-response";
import { postSearch } from "@/lib/search/client";
import type { LodgingOption, Trip } from "@/lib/types";
import { ExternalLinks, SourceInfo } from "./source-info";
import { useTripCoords } from "./use-trip-coords";

const yesNo = (v: boolean | null) => (v == null ? "não informado" : v ? "sim" : "não");

export function LodgingSearch({ trip }: { trip: Trip }) {
  const toast = useToast();
  const { coords, locate } = useTripCoords(trip);
  const [f, setF] = useState({
    destination: trip.destination,
    check_in: trip.start_date,
    check_out: trip.end_date,
    adults: trip.adults,
    children_ages: trip.children_ages.join(", "),
    rooms: 2,
    beds: trip.adults + trip.children,
    kind: trip.lodging_prefs.includes("apartamento") ? "apartamento" : "qualquer",
  });
  const [data, setData] = useState<SearchApiResponse<LodgingOption> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const ages = f.children_ages.split(/[,\s]+/).filter(Boolean).map(Number);
  const nights = Math.max(1, Math.round((Date.parse(f.check_out) - Date.parse(f.check_in)) / 86_400_000));

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const at = coords ?? (await locate());
      setData(
        await postSearch<LodgingOption>("/api/search/lodging", {
          destination: f.destination,
          lat: at?.lat,
          lng: at?.lng,
          check_in: f.check_in,
          check_out: f.check_out,
          adults: f.adults,
          children: ages.length,
          children_ages: ages,
          rooms: f.rooms,
          beds: f.beds,
          kind: f.kind,
          currency: trip.currency,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function saveQuote(o: LodgingOption) {
    if (o.total_price == null) return;
    try {
      const fx = o.currency === trip.currency ? 1 : (await fetchFxRate(o.currency, trip.currency)).rate;
      await getRepo().insert("quotes", {
        trip_id: trip.id,
        type: "hospedagem",
        title: `${o.name} · ${nights} noite(s)`,
        provider_name: o.provider,
        source: o.provider.startsWith("Mock") ? "demo" : "api",
        url: o.booking_url,
        total_price: o.total_price,
        currency: o.currency,
        fx_rate: fx,
        travelers_count: f.adults + ages.length,
        units: nights,
        captured_at: o.queried_at,
        valid_until: null,
        search_key: `hospedagem:${f.destination}:${f.check_in}:${f.check_out}`.toLowerCase(),
        details: { ...o },
        status: "ativa",
        expense_id: null,
        notes: o.cancellation,
      });
      toast("Salvo no comparador.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro", "error");
    }
  }

  const links = lodgingLinks({ destination: f.destination, check_in: f.check_in, check_out: f.check_out, adults: f.adults, children_ages: ages, rooms: f.rooms });

  return (
    <div className="space-y-4">
      <Card>
        <CardBody>
          <form onSubmit={search} className="grid gap-3 md:grid-cols-4">
            <Field label="Destino" className="md:col-span-2">{(p) => <Input {...p} value={f.destination} onChange={(e) => set("destination", e.target.value)} required />}</Field>
            <Field label="Check-in">{(p) => <Input {...p} type="date" value={f.check_in} onChange={(e) => set("check_in", e.target.value)} />}</Field>
            <Field label="Check-out">{(p) => <Input {...p} type="date" value={f.check_out} onChange={(e) => set("check_out", e.target.value)} />}</Field>
            <Field label="Adultos">{(p) => <Input {...p} type="number" min={1} value={f.adults} onChange={(e) => set("adults", Number(e.target.value))} />}</Field>
            <Field label="Idades das crianças" hint="Separadas por vírgula">{(p) => <Input {...p} value={f.children_ages} onChange={(e) => set("children_ages", e.target.value)} />}</Field>
            <Field label="Quartos">{(p) => <Input {...p} type="number" min={1} value={f.rooms} onChange={(e) => set("rooms", Number(e.target.value))} />}</Field>
            <Field label="Camas">{(p) => <Input {...p} type="number" min={0} value={f.beds} onChange={(e) => set("beds", Number(e.target.value))} />}</Field>
            <Field label="Tipo">
              {(p) => (
                <Select {...p} value={f.kind} onChange={(e) => set("kind", e.target.value)}>
                  <option value="qualquer">Qualquer</option>
                  <option value="hotel">Hotel</option>
                  <option value="apartamento">Apartamento</option>
                  <option value="casa">Casa</option>
                </Select>
              )}
            </Field>
            <div className="flex items-end md:col-span-3 md:justify-end">
              <Button type="submit" loading={loading}>
                <BedDouble className="h-4 w-4" aria-hidden /> Pesquisar hospedagem
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
      {error && <Notice tone="error">{error}</Notice>}
      {data && <SourceInfo data={data} />}
      {data?.available && !data.results.length && !data.errors.length && <EmptyState title="Nenhuma hospedagem retornada pela fonte">Use os links externos abaixo.</EmptyState>}
      <div className="grid gap-3 md:grid-cols-2">
        {data?.results.map((o) => (
          <Card key={o.id}>
            <CardBody className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{o.name}</h3>
                  <div className="text-xs text-muted">
                    {o.kind} · {o.provider} · consultado em {fmtDateTime(o.queried_at)}
                  </div>
                </div>
                {o.availability_confirmed ? <Badge tone="green">Disponível na consulta</Badge> : <Badge tone="amber">Disponibilidade não confirmada</Badge>}
              </div>
              <div className="text-lg font-bold tabular-nums">
                {o.total_price != null ? money(o.total_price, o.currency) : "Preço não informado"}
                {o.total_price != null && <span className="ml-1 text-xs font-normal text-muted">estadia · {o.taxes_included == null ? "taxas não informadas" : o.taxes_included ? "com taxas" : "sem algumas taxas"}</span>}
              </div>
              <ul className="grid grid-cols-2 gap-x-3 text-sm text-muted">
                <li>Café da manhã: {yesNo(o.breakfast)}</li>
                <li>Cozinha: {yesNo(o.kitchen)}</li>
                <li>Estacionamento: {yesNo(o.parking)}</li>
                <li>Avaliação: {o.rating ?? "não informada"}</li>
                <li className="col-span-2">Distância do centro: {o.distance_center_km != null ? `${o.distance_center_km.toFixed(1)} km` : "não informada"}</li>
                <li className="col-span-2">Cancelamento: {o.cancellation}</li>
              </ul>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => saveQuote(o)} disabled={o.total_price == null}>
                  <Save className="h-4 w-4" aria-hidden /> Salvar cotação
                </Button>
                {o.booking_url && <ExternalLink href={o.booking_url}>Reservar no fornecedor</ExternalLink>}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
      <ExternalLinks links={data?.links ?? links} />
    </div>
  );
}
