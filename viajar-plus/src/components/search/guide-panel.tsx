"use client";
import { useEffect, useMemo, useState } from "react";
import { Bookmark, Church, Coffee, Landmark, MapPin, Mountain, Search, Trees, UtensilsCrossed, Wine, Camera, Soup } from "lucide-react";
import { MapView } from "@/components/map";
import { Badge } from "@/components/ui/badge";
import { Button, ExternalLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { EmptyState, Loading, Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { getRepo } from "@/lib/data";
import { useRows } from "@/lib/data/hooks";
import { cn } from "@/lib/cn";
import { mapLinks } from "@/lib/providers/links";
import type { Place, PlaceCategory, ProviderResponse } from "@/lib/providers/types";
import { getProvider } from "@/lib/search/client";
import type { ActivityCategory, ItineraryItemKind, Trip } from "@/lib/types";
import { AddToItineraryButton } from "./add-to-itinerary";
import { useTripCoords } from "./use-trip-coords";

export const GUIDE_CATEGORIES: { value: PlaceCategory; label: string; icon: typeof Search; color: string; tip: string }[] = [
  { value: "restaurante", label: "Restaurantes", icon: UtensilsCrossed, color: "#dc2626", tip: "Reserve jantares nos lugares mais procurados." },
  { value: "culinaria", label: "Culinária local", icon: Soup, color: "#b45309", tip: "Peça o prato típico e visite mercados/empórios locais." },
  { value: "bar", label: "Bares", icon: Wine, color: "#7c3aed", tip: "Confira horários; não dirija após beber." },
  { value: "cafe", label: "Cafés e doces", icon: Coffee, color: "#92400e", tip: "Ótimos para pausas em dias frios." },
  { value: "religioso", label: "Locais religiosos", icon: Church, color: "#1d4ed8", tip: "Respeite horários de culto e regras para fotos." },
  { value: "mirante", label: "Instagramáveis e mirantes", icon: Camera, color: "#ea7a32", tip: "Luz dourada: logo após o nascer e antes do pôr do sol." },
  { value: "museu", label: "Museus e galerias", icon: Landmark, color: "#0f766e", tip: "Muitos fecham um dia por semana." },
  { value: "parque", label: "Parques e natureza", icon: Trees, color: "#15803d", tip: "Áreas gratuitas podem cobrar taxa de parque ou exigir transporte." },
  { value: "atracao", label: "Atrações", icon: Mountain, color: "#0369a1", tip: "Confirme ingressos e horários no site oficial." },
];

const TO_ACTIVITY: Record<PlaceCategory, ActivityCategory> = {
  restaurante: "restaurante",
  culinaria: "culinaria",
  bar: "bar",
  cafe: "cafe",
  religioso: "religioso",
  mirante: "mirante",
  museu: "museu",
  parque: "parque",
  atracao: "atracao",
};

const TO_KIND: Partial<Record<PlaceCategory, ItineraryItemKind>> = { restaurante: "refeicao", culinaria: "refeicao", bar: "refeicao", cafe: "refeicao" };

const WHEEL: Record<string, string> = { yes: "Acessível para cadeira de rodas", limited: "Acessibilidade limitada", no: "Sem acesso para cadeira de rodas" };

export function GuidePanel({ trip, initialCategory }: { trip: Trip; initialCategory?: PlaceCategory }) {
  const toast = useToast();
  const { coords, loading: locating, error: geoError, locate } = useTripCoords(trip);
  const [category, setCategory] = useState<PlaceCategory>(initialCategory ?? "restaurante");
  const [radius, setRadius] = useState(3000);
  const [data, setData] = useState<ProviderResponse<Place> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const { data: saved } = useRows("activities", { trip_id: trip.id });
  const savedRefs = useMemo(() => new Set(saved.map((a) => a.source_ref)), [saved]);
  const cat = GUIDE_CATEGORIES.find((c) => c.value === category)!;

  useEffect(() => {
    if (initialCategory) setCategory(initialCategory);
  }, [initialCategory]);

  async function search(c: PlaceCategory = category) {
    setLoading(true);
    setError(null);
    try {
      const at = coords ?? (await locate());
      if (!at) throw new Error("Localize o destino no mapa antes de pesquisar.");
      const r = await getProvider<Place>("/api/places", { lat: at.lat, lng: at.lng, category: c, radius_m: radius, limit: 60 });
      setData(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function save(p: Place) {
    try {
      await getRepo().insert("activities", {
        trip_id: trip.id,
        name: p.name,
        category: TO_ACTIVITY[p.category],
        description: [p.cuisine && `Cozinha: ${p.cuisine}`, p.religion && `Religião: ${p.religion}`, p.subtype].filter(Boolean).join(" · "),
        price_per_person: null,
        price_group: null,
        currency: trip.currency,
        duration_min: null,
        min_age: null,
        accessibility: WHEEL[p.wheelchair] ?? "",
        meeting_point: p.address,
        cancellation_policy: "",
        provider_name: "OpenStreetMap",
        url: p.website,
        lat: p.lat,
        lng: p.lng,
        opening_hours: p.opening_hours,
        free_entry: p.fee === false ? true : null,
        instagrammable: p.category === "mirante",
        source: "osm",
        source_ref: p.id,
      });
      toast("Salvo nos lugares da viagem.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro", "error");
    }
  }

  const results = data?.results ?? [];

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Categorias do guia" className="flex flex-wrap gap-2">
        {GUIDE_CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            aria-pressed={category === c.value}
            onClick={() => {
              setCategory(c.value);
              if (data || coords) search(c.value);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition",
              category === c.value ? "border-accent bg-accent text-accent-fg" : "border-line bg-surface hover:bg-surface-2",
            )}
          >
            <c.icon className="h-4 w-4" aria-hidden /> {c.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Raio">
          {(p) => (
            <Select {...p} value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
              <option value={1000}>1 km</option>
              <option value={3000}>3 km</option>
              <option value={8000}>8 km</option>
              <option value={20000}>20 km</option>
            </Select>
          )}
        </Field>
        <Button onClick={() => search()} loading={loading || locating}>
          <Search className="h-4 w-4" aria-hidden /> Buscar em {trip.destination}
        </Button>
        {!coords && (
          <Button variant="outline" onClick={locate} loading={locating}>
            <MapPin className="h-4 w-4" aria-hidden /> Localizar destino
          </Button>
        )}
        <p className="pb-2 text-sm text-muted">Dica: {cat.tip}</p>
      </div>
      {geoError && <Notice tone="error">{geoError}</Notice>}
      {error && (
        <Notice tone="error" title="Não foi possível consultar o OpenStreetMap agora">
          {error} Os servidores públicos do Overpass às vezes ficam sobrecarregados — tente de novo em alguns minutos.
        </Notice>
      )}
      {loading && <Loading label="Buscando lugares…" />}
      {data && (
        <p className="text-xs text-muted">
          {results.length} lugar(es) · {data.attribution} {data.cached ? "· resultado em cache" : ""} · {data.notice}
        </p>
      )}
      {coords && (results.length > 0 || !data) && (
        <MapView
          markers={results.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, title: p.name, subtitle: p.cuisine || p.religion || p.subtype, color: cat.color }))}
          center={[coords.lat, coords.lng]}
          zoom={13}
          height={340}
          onSelect={(id) => {
            setSelected(id);
            document.getElementById(`place-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        />
      )}
      {data && !results.length && !loading && (
        <EmptyState icon={<cat.icon />} title="Nada encontrado nesta categoria">
          O mapa colaborativo pode não ter registros aqui. Aumente o raio ou tente outra categoria.
        </EmptyState>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {results.map((p) => (
          <Card key={p.id} id={`place-${p.id}`} className={cn(selected === p.id && "ring-2 ring-accent")}>
            <CardBody className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold leading-tight">{p.name}</h3>
                  <div className="text-xs text-muted">
                    {[p.cuisine, p.religion, p.subtype].filter(Boolean).join(" · ")}
                    {p.distance_m != null && ` · ${p.distance_m < 1000 ? `${p.distance_m} m` : `${(p.distance_m / 1000).toFixed(1)} km`} do centro`}
                  </div>
                </div>
                {p.category === "mirante" && <Badge tone="orange">instagramável</Badge>}
              </div>
              {p.address && <div className="text-sm">{p.address}</div>}
              <div className="flex flex-wrap gap-1 text-xs">
                {p.opening_hours && <Badge>Horário: {p.opening_hours}</Badge>}
                {WHEEL[p.wheelchair] && <Badge tone={p.wheelchair === "yes" ? "green" : "amber"}>{WHEEL[p.wheelchair]}</Badge>}
                {p.fee === false && <Badge tone="green">Sem ingresso (transporte e taxas não incluídos)</Badge>}
                {p.fee === true && <Badge tone="amber">Cobra entrada</Badge>}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => save(p)} disabled={savedRefs.has(p.id)}>
                  <Bookmark className="h-4 w-4" aria-hidden /> {savedRefs.has(p.id) ? "Salvo" : "Salvar"}
                </Button>
                <AddToItineraryButton
                  trip={trip}
                  draft={{
                    title: p.name,
                    kind: TO_KIND[p.category] ?? "passeio",
                    duration_min: TO_KIND[p.category] ? 90 : 60,
                    address: p.address || p.name,
                    lat: p.lat,
                    lng: p.lng,
                    opening_hours: p.opening_hours,
                    notes: "Sugestão do guia (OpenStreetMap). Confirme horários antes de ir.",
                  }}
                />
                {mapLinks(p.lat, p.lng, p.id).map((l) => (
                  <ExternalLink key={l.label} href={l.url} className="text-xs">
                    {l.label}
                  </ExternalLink>
                ))}
                {p.website && (
                  <ExternalLink href={p.website} className="text-xs">
                    Site
                  </ExternalLink>
                )}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
