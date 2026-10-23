"use client";
import { useMemo, useState } from "react";
import { Plane, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ExternalLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { EmptyState, Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { getRepo } from "@/lib/data";
import { fetchFxRate } from "@/lib/fx-client";
import { fmtDateTime, minutesLabel, money } from "@/lib/format";
import { flightLinks } from "@/lib/providers/links";
import type { SearchApiResponse } from "@/lib/providers/search-response";
import { postSearch } from "@/lib/search/client";
import type { FlightOption, Trip } from "@/lib/types";
import { guessIata } from "./iata";
import { ExternalLinks, SourceInfo } from "./source-info";

type Sort = "preco" | "duracao" | "escalas" | "horario";
const timeOfDay = (iso: string) => {
  const h = Number(iso.slice(11, 13));
  return h < 12 ? "manha" : h < 18 ? "tarde" : "noite";
};
const hhmm = (iso: string) => iso.slice(11, 16);

export function FlightSearch({ trip }: { trip: Trip }) {
  const toast = useToast();
  const [f, setF] = useState({
    origin: guessIata(trip.origin),
    destination: guessIata(trip.destination),
    departure_date: trip.start_date,
    return_date: trip.end_date,
    oneway: false,
    adults: trip.adults,
    children: trip.children,
    children_ages: trip.children_ages.join(", "),
    cabin: "ECONOMY",
    checked_bags: 1,
    flex_days: 0,
    nonstop: false,
    extra_origins: "",
    extra_destinations: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SearchApiResponse<FlightOption> | null>(null);
  const [sort, setSort] = useState<Sort>("preco");
  const [maxStops, setMaxStops] = useState("todas");
  const [period, setPeriod] = useState("todos");
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const codes = (s: string) =>
    s
      .split(/[,\s]+/)
      .map((x) => x.trim().toUpperCase())
      .filter((x) => /^[A-Z]{3}$/.test(x))
      .slice(0, 2);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const ages = f.children_ages
        .split(/[,\s]+/)
        .filter(Boolean)
        .map(Number);
      const res = await postSearch<FlightOption>("/api/search/flights", {
        origin: f.origin,
        destination: f.destination,
        departure_date: f.departure_date,
        return_date: f.oneway ? null : f.return_date,
        adults: f.adults,
        children: f.children,
        children_ages: ages.length ? ages : [],
        cabin: f.cabin,
        checked_bags: f.checked_bags,
        flex_days: f.flex_days,
        nonstop: f.nonstop,
        extra_origins: codes(f.extra_origins),
        extra_destinations: codes(f.extra_destinations),
        currency: trip.currency,
      });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const results = useMemo(() => {
    let list = [...(data?.results ?? [])];
    if (maxStops !== "todas") list = list.filter((o) => o.stops <= Number(maxStops));
    if (period !== "todos") list = list.filter((o) => o.segments[0] && timeOfDay(o.segments[0].depart_at) === period);
    const by: Record<Sort, (a: FlightOption, b: FlightOption) => number> = {
      preco: (a, b) => a.total_price - b.total_price,
      duracao: (a, b) => a.outbound_duration_min - b.outbound_duration_min,
      escalas: (a, b) => a.stops - b.stops || a.total_price - b.total_price,
      horario: (a, b) => (a.segments[0]?.depart_at ?? "").localeCompare(b.segments[0]?.depart_at ?? ""),
    };
    return list.sort(by[sort]);
  }, [data, sort, maxStops, period]);

  async function saveQuote(o: FlightOption) {
    try {
      const fx = o.currency === trip.currency ? 1 : (await fetchFxRate(o.currency, trip.currency)).rate;
      const first = o.segments[0];
      const last = o.segments[o.segments.length - 1];
      await getRepo().insert("quotes", {
        trip_id: trip.id,
        type: "voo",
        title: `${o.carrier_names.join(" / ")} · ${first?.from ?? ""} → ${last?.to ?? ""} · ${o.stops ? `${o.stops} escala(s)` : "direto"}`,
        provider_name: o.provider,
        source: o.provider.startsWith("Mock") ? "demo" : "api",
        url: o.booking_url,
        total_price: o.total_price,
        currency: o.currency,
        fx_rate: fx,
        travelers_count: f.adults + f.children,
        units: 1,
        captured_at: o.queried_at,
        valid_until: null,
        search_key: `voo:${f.origin}-${f.destination}:${f.departure_date}:${f.oneway ? "" : f.return_date}`.toLowerCase(),
        details: { ...o },
        status: "ativa",
        expense_id: null,
        notes: o.fare_rules,
      });
      toast("Salvo no comparador de cotações.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao salvar", "error");
    }
  }

  const links = flightLinks({
    origin: f.origin || "GRU",
    destination: f.destination || "FTE",
    departure_date: f.departure_date,
    return_date: f.oneway ? null : f.return_date,
    adults: f.adults,
    children_ages: f.children_ages.split(/[,\s]+/).filter(Boolean).map(Number),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardBody>
          <form onSubmit={search} className="grid gap-3 md:grid-cols-6">
            <Field label="Origem (IATA)" hint="Ex.: GRU">
              {(p) => <Input {...p} value={f.origin} maxLength={3} onChange={(e) => set("origin", e.target.value.toUpperCase())} required />}
            </Field>
            <Field label="Destino (IATA)" hint="Ex.: FTE">
              {(p) => <Input {...p} value={f.destination} maxLength={3} onChange={(e) => set("destination", e.target.value.toUpperCase())} required />}
            </Field>
            <Field label="Ida">{(p) => <Input {...p} type="date" value={f.departure_date} onChange={(e) => set("departure_date", e.target.value)} required />}</Field>
            <Field label="Volta">{(p) => <Input {...p} type="date" value={f.return_date} disabled={f.oneway} onChange={(e) => set("return_date", e.target.value)} />}</Field>
            <Field label="Adultos">{(p) => <Input {...p} type="number" min={1} max={9} value={f.adults} onChange={(e) => set("adults", Number(e.target.value))} />}</Field>
            <Field label="Crianças">{(p) => <Input {...p} type="number" min={0} max={8} value={f.children} onChange={(e) => set("children", Number(e.target.value))} />}</Field>
            <Field label="Idades das crianças" hint="Separadas por vírgula">
              {(p) => <Input {...p} value={f.children_ages} onChange={(e) => set("children_ages", e.target.value)} disabled={!f.children} />}
            </Field>
            <Field label="Classe">
              {(p) => (
                <Select {...p} value={f.cabin} onChange={(e) => set("cabin", e.target.value)}>
                  <option value="ECONOMY">Econômica</option>
                  <option value="PREMIUM_ECONOMY">Premium economy</option>
                  <option value="BUSINESS">Executiva</option>
                  <option value="FIRST">Primeira</option>
                </Select>
              )}
            </Field>
            <Field label="Malas despachadas/pessoa">{(p) => <Input {...p} type="number" min={0} max={3} value={f.checked_bags} onChange={(e) => set("checked_bags", Number(e.target.value))} />}</Field>
            <Field label="Flexibilidade de datas">
              {(p) => (
                <Select {...p} value={f.flex_days} onChange={(e) => set("flex_days", Number(e.target.value))}>
                  <option value={0}>Datas exatas</option>
                  <option value={1}>± 1 dia</option>
                  <option value={2}>± 2 dias</option>
                  <option value={3}>± 3 dias</option>
                </Select>
              )}
            </Field>
            <Field label="Aeroportos alternativos (origem)" hint="Ex.: CGH, VCP">
              {(p) => <Input {...p} value={f.extra_origins} onChange={(e) => set("extra_origins", e.target.value)} />}
            </Field>
            <Field label="Aeroportos alternativos (destino)" hint="Ex.: RGL">
              {(p) => <Input {...p} value={f.extra_destinations} onChange={(e) => set("extra_destinations", e.target.value)} />}
            </Field>
            <div className="flex flex-wrap items-center gap-4 md:col-span-4">
              <Checkbox label="Somente ida" checked={f.oneway} onChange={(e) => set("oneway", e.target.checked)} />
              <Checkbox label="Somente voos diretos" checked={f.nonstop} onChange={(e) => set("nonstop", e.target.checked)} />
            </div>
            <div className="flex items-end justify-end md:col-span-2">
              <Button type="submit" loading={loading} className="w-full md:w-auto">
                <Plane className="h-4 w-4" aria-hidden /> Pesquisar voos
              </Button>
            </div>
          </form>
          <p className="mt-3 text-xs text-muted">
            A bagagem escolhida serve de referência na comparação; cada tarifa mostra a bagagem que a fonte informa como incluída. O VIAJAR+ nunca conclui compras.
          </p>
        </CardBody>
      </Card>

      {error && <Notice tone="error">{error}</Notice>}
      {data && <SourceInfo data={data} />}

      {data && data.results.length > 0 && (
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Ordenar por">
            {(p) => (
              <Select {...p} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="preco">Preço</option>
                <option value="duracao">Duração</option>
                <option value="escalas">Escalas</option>
                <option value="horario">Horário de partida</option>
              </Select>
            )}
          </Field>
          <Field label="Escalas">
            {(p) => (
              <Select {...p} value={maxStops} onChange={(e) => setMaxStops(e.target.value)}>
                <option value="todas">Todas</option>
                <option value="0">Somente diretos</option>
                <option value="1">Até 1 escala</option>
                <option value="2">Até 2 escalas</option>
              </Select>
            )}
          </Field>
          <Field label="Partida">
            {(p) => (
              <Select {...p} value={period} onChange={(e) => setPeriod(e.target.value)}>
                <option value="todos">Qualquer horário</option>
                <option value="manha">Manhã</option>
                <option value="tarde">Tarde</option>
                <option value="noite">Noite</option>
              </Select>
            )}
          </Field>
          <span className="pb-2 text-sm text-muted">{results.length} opção(ões)</span>
        </div>
      )}

      {data && data.available && !results.length && !data.errors.length && <EmptyState title="Nenhum voo encontrado">Tente outras datas, aeroportos alternativos ou flexibilidade.</EmptyState>}

      <div className="space-y-3">
        {results.map((o) => (
          <Card key={o.id}>
            <CardBody className="grid gap-3 md:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{o.carrier_names.join(" / ")}</span>
                  <Badge tone={o.stops ? "amber" : "green"}>{o.stops ? `${o.stops} escala(s)` : "Direto"}</Badge>
                  {o.cabin && <Badge>{o.cabin}</Badge>}
                  {o.provider.startsWith("Mock") && <Badge tone="red">DADOS FICTÍCIOS</Badge>}
                </div>
                <ol className="mt-2 space-y-0.5 text-sm">
                  {o.segments.map((s, i) => (
                    <li key={i} className="tabular-nums">
                      <span className="font-medium">
                        {s.from} {hhmm(s.depart_at)} → {s.to} {hhmm(s.arrive_at)}
                      </span>{" "}
                      <span className="text-muted">
                        · {s.flight_number} · {s.depart_at.slice(0, 10)}
                      </span>
                    </li>
                  ))}
                </ol>
                <div className="mt-2 text-xs text-muted">
                  Ida: {minutesLabel(o.outbound_duration_min)} · {o.baggage_included} · {o.fare_rules}
                </div>
                <div className="text-xs text-muted">
                  Fonte: {o.provider} · consultado em {fmtDateTime(o.queried_at)}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 text-right">
                <div>
                  <div className="text-xl font-bold tabular-nums">{money(o.total_price, o.currency)}</div>
                  <div className="text-xs text-muted">total para {f.adults + f.children} viajante(s)</div>
                  <div className="text-sm tabular-nums">{money(o.price_per_person, o.currency)} / pessoa</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => saveQuote(o)}>
                    <Save className="h-4 w-4" aria-hidden /> Salvar cotação
                  </Button>
                </div>
                {o.booking_url ? (
                  <ExternalLink href={o.booking_url} className="text-sm">
                    Concluir no fornecedor
                  </ExternalLink>
                ) : (
                  <span className="text-xs text-muted">Compra no site da companhia/agência (links abaixo)</span>
                )}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <ExternalLinks links={data?.links ?? links} />
    </div>
  );
}
