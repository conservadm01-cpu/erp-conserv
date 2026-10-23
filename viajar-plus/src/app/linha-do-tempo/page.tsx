"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Camera, Feather, Aperture as Instagram, MapPin, Sun, Sunrise, Sunset } from "lucide-react";
import { RequireTrip } from "@/components/layout/require-trip";
import { PageHeader, Notice } from "@/components/ui/states";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, Textarea, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { MapView } from "@/components/map";
import { useRows } from "@/lib/data/hooks";
import { getRepo } from "@/lib/data";
import { useTrip } from "@/lib/trips/context";
import { useMediaUrl } from "@/lib/media/use-media-url";
import { goldenHours, hhmm } from "@/lib/guide/sun";
import { dateRange, fmtDate } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/trips/service";
import type { DiaryEntry, ISODate, MediaAsset, Trip } from "@/lib/types";

const TIMEZONES = [
  "America/Sao_Paulo", "America/Manaus", "America/Argentina/Buenos_Aires", "America/Argentina/Rio_Gallegos", "America/Santiago",
  "America/Montevideo", "America/Lima", "America/Bogota", "America/Mexico_City", "America/New_York", "America/Los_Angeles",
  "Europe/Lisbon", "Europe/Madrid", "Europe/Paris", "Europe/Rome", "Europe/London", "Asia/Tokyo", "Australia/Sydney",
];

const STORY_PROMPTS = [
  "Qual foi o momento que vocês não querem esquecer?",
  "O que vocês provaram hoje que merece ser lembrado?",
  "Teve alguma surpresa, imprevisto ou risada?",
  "Se este dia fosse uma foto, qual seria?",
];

export default function LinhaDoTempoPage() {
  return <RequireTrip>{(trip) => <Timeline trip={trip} />}</RequireTrip>;
}

function Timeline({ trip }: { trip: Trip }) {
  const { trips, select } = useTrip();
  const where = { trip_id: trip.id };
  const diary = useRows("diary_entries", where);
  const media = useRows("media_assets", where);
  const days = useRows("itinerary_days", where);
  const items = useRows("itinerary_items", where);
  const activities = useRows("activities", where);
  const [tz, setTz] = useState<string>("");

  useEffect(() => {
    try {
      setTz(localStorage.getItem(`viajar:tz:${trip.id}`) ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {
      setTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
    }
  }, [trip.id]);
  const changeTz = (v: string) => {
    setTz(v);
    try {
      localStorage.setItem(`viajar:tz:${trip.id}`, v);
    } catch {
      /* ignore */
    }
  };

  const allDates = dateRange(trip.start_date, trip.end_date);
  const byDay = useMemo(() => {
    const dayOf = (iso: string | null) => (iso ? iso.slice(0, 10) : null);
    return allDates.map((date) => ({
      date,
      itinerary: items.data
        .filter((i) => days.data.find((d) => d.id === i.day_id)?.date === date)
        .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? "")),
      entries: diary.data.filter((e) => e.date === date),
      photos: media.data.filter((m) => dayOf(m.taken_at) === date || (m.diary_entry_id && diary.data.find((e) => e.id === m.diary_entry_id)?.date === date)),
    }));
  }, [allDates, items.data, days.data, diary.data, media.data]);

  const insta = [
    ...activities.data.filter((a) => a.instagrammable || a.category === "mirante").map((a) => ({ id: a.id, title: a.name, sub: a.description || a.category, lat: a.lat, lng: a.lng, kind: "lugar" as const })),
    ...diary.data.filter((e) => e.instagrammable).map((e) => ({ id: e.id, title: e.title, sub: e.location_name, lat: e.lat, lng: e.lng, kind: "diário" as const })),
    ...media.data.filter((m) => m.instagrammable).map((m) => ({ id: m.id, title: m.caption || m.original_name, sub: m.album, lat: m.lat, lng: m.lng, kind: "foto" as const })),
  ];

  const markers = [
    ...diary.data.filter((e) => e.lat != null && e.lng != null).map((e) => ({ id: `d:${e.id}`, lat: e.lat!, lng: e.lng!, title: e.title, subtitle: fmtDate(e.date), color: "#ea7a32" })),
    ...media.data.filter((m) => m.lat != null && m.lng != null).map((m) => ({ id: `m:${m.id}`, lat: m.lat!, lng: m.lng!, title: m.caption || m.original_name, subtitle: m.taken_at ? fmtDate(m.taken_at) : "", color: "#2a78d6" })),
    ...activities.data.filter((a) => a.instagrammable && a.lat != null && a.lng != null).map((a) => ({ id: `a:${a.id}`, lat: a.lat!, lng: a.lng!, title: a.name, subtitle: "instagramável", color: "#1baf7a" })),
  ];

  const sunDay = allDates[Math.floor(allDates.length / 2)] ?? trip.start_date;
  const golden = trip.destination_lat != null && trip.destination_lng != null ? goldenHours(sunDay, trip.destination_lat, trip.destination_lng) : null;

  return (
    <>
      <PageHeader eyebrow="Linha do tempo" title="A história de vocês, dia a dia" description="Roteiro, diário e fotos juntos, em ordem. Destaque os lugares instagramáveis e conte a história de cada dia." />

      <section aria-labelledby="trips-tl" className="mb-8">
        <h2 id="trips-tl" className="mb-3 font-display text-xl font-semibold">Minhas viagens</h2>
        <ol className="flex gap-3 overflow-x-auto pb-2">
          {trips.map((t) => (
            <li key={t.id} className="shrink-0">
              <button
                onClick={() => select(t.id)}
                aria-current={t.id === trip.id ? "true" : undefined}
                className={`w-56 rounded-2xl border p-3 text-left transition ${t.id === trip.id ? "border-accent bg-accent/10" : "border-line bg-surface hover:bg-surface-2"}`}
              >
                <div className="text-xs text-muted">{fmtDate(t.start_date, { month: "short", year: "numeric" })} · {STATUS_LABEL[t.status]}</div>
                <div className="line-clamp-2 font-semibold">{t.name}</div>
                <div className="text-xs text-muted">{t.destination}</div>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {byDay.map((d, i) => (
            <DayBlock key={d.date} trip={trip} index={i + 1} {...d} />
          ))}
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title="Onde e quando fotografar" subtitle="Lugares instagramáveis e horário dourado" />
            <CardBody className="space-y-4 text-sm">
              {golden ? (
                <div className="space-y-2">
                  <label className="block text-xs text-muted" htmlFor="tz">Fuso horário do destino</label>
                  <Select id="tz" value={tz} onChange={(e) => changeTz(e.target.value)}>
                    {[...new Set([tz, ...TIMEZONES])].filter(Boolean).map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
                  </Select>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-surface-2 p-2"><Sunrise className="mb-1 h-4 w-4 text-sunset-500" aria-hidden />Nascer {hhmm(golden.sunrise, tz || undefined)}<br /><span className="text-xs text-muted">luz dourada até {hhmm(golden.morningEnd, tz || undefined)}</span></div>
                    <div className="rounded-lg bg-surface-2 p-2"><Sunset className="mb-1 h-4 w-4 text-sunset-500" aria-hidden />Pôr {hhmm(golden.sunset, tz || undefined)}<br /><span className="text-xs text-muted">luz dourada desde {hhmm(golden.eveningStart, tz || undefined)}</span></div>
                  </div>
                  <p className="text-xs text-muted">Calculado astronomicamente para {fmtDate(sunDay)} nas coordenadas do destino (±2 min). Nuvens e relevo podem antecipar o pôr do sol.</p>
                </div>
              ) : (
                <Notice>Localize o destino em Pesquisar → Guia local para calcular nascer/pôr do sol e o horário dourado.</Notice>
              )}
              <div>
                <h3 className="mb-2 flex items-center gap-1.5 font-semibold"><Instagram className="h-4 w-4" aria-hidden /> Instagramáveis</h3>
                {!insta.length ? (
                  <p className="text-muted">Nenhum ainda. Marque mirantes no Guia local, fotos na galeria ou registros do diário como “instagramável”.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {insta.slice(0, 12).map((x) => (
                      <li key={`${x.kind}${x.id}`} className="flex items-start gap-2"><Badge tone="orange">{x.kind}</Badge><span><strong>{x.title}</strong>{x.sub ? <span className="text-muted"> · {x.sub}</span> : null}</span></li>
                    ))}
                  </ul>
                )}
                <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted">
                  <li>Mirantes rendem mais na luz dourada; ao meio-dia, prefira bosques, interiores e detalhes.</li>
                  <li>Inclua uma pessoa em primeiro plano para dar escala a glaciares, montanhas e templos.</li>
                  <li>Em locais religiosos, confirme se fotos são permitidas e evite flash durante celebrações.</li>
                </ul>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Mapa de memórias" subtitle={`${markers.length} ponto(s) com localização`} />
            <CardBody>
              {markers.length || trip.destination_lat != null ? (
                <MapView markers={markers} center={trip.destination_lat != null && trip.destination_lng != null ? [trip.destination_lat, trip.destination_lng] : undefined} zoom={10} height={280} />
              ) : (
                <p className="text-sm text-muted">Fotos com GPS (se você autorizar) e registros com local aparecem aqui.</p>
              )}
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}

function DayBlock({ trip, index, date, itinerary, entries, photos }: { trip: Trip; index: number; date: ISODate; itinerary: { id: string; title: string; start_time: string | null; booking_status: string }[]; entries: DiaryEntry[]; photos: MediaAsset[] }) {
  const empty = !itinerary.length && !entries.length && !photos.length;
  return (
    <section className="relative border-l-2 border-line pl-6" aria-labelledby={`d-${date}`}>
      <span className="absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-surface bg-accent" aria-hidden />
      <h2 id={`d-${date}`} className="font-display text-xl font-bold">
        Dia {index} <span className="text-base font-normal text-muted">· {fmtDate(date, { weekday: "long", day: "2-digit", month: "long" })}</span>
      </h2>
      {itinerary.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {itinerary.map((i) => (
            <li key={i.id} className="flex gap-2"><span className="w-12 shrink-0 tabular-nums text-muted">{i.start_time ?? "—"}</span>{i.title}{i.booking_status === "reservado" && <Badge tone="green">reservado</Badge>}</li>
          ))}
        </ul>
      )}
      {entries.map((e) => (
        <article key={e.id} className="mt-3 rounded-xl border border-line bg-surface p-4">
          <h3 className="flex items-center gap-2 font-semibold"><Feather className="h-4 w-4 text-sunset-500" aria-hidden />{e.title}{e.instagrammable && <Badge tone="orange">instagramável</Badge>}</h3>
          {e.location_name && <p className="flex items-center gap-1 text-xs text-muted"><MapPin className="h-3 w-3" aria-hidden />{e.location_name}</p>}
          {e.body && <p className="mt-2 line-clamp-4 whitespace-pre-line text-sm">{e.body}</p>}
        </article>
      ))}
      {photos.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {photos.slice(0, 10).map((m) => <Photo key={m.id} m={m} />)}
        </div>
      )}
      <StoryBox trip={trip} date={date} hasEntries={entries.length > 0} empty={empty} index={index} />
    </section>
  );
}

function Photo({ m }: { m: MediaAsset }) {
  const url = useMediaUrl(m.thumb_path ?? (m.kind === "image" ? m.storage_path : null));
  return (
    <Link href={m.kind === "image" ? `/midia/foto/${m.id}` : "/midia"} className="relative block aspect-square overflow-hidden rounded-lg bg-surface-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt={m.caption || m.original_name} className="h-full w-full object-cover" /> : <Camera className="m-auto mt-6 h-6 w-6 text-muted" aria-hidden />}
      {m.instagrammable && <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white">insta</span>}
    </Link>
  );
}

/** Espaço "Conte sua história": perguntas que viram registro no diário. */
function StoryBox({ trip, date, hasEntries, empty, index }: { trip: Trip; date: ISODate; hasEntries: boolean; empty: boolean; index: number }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [answers, setAnswers] = useState<string[]>(STORY_PROMPTS.map(() => ""));
  const toast = useToast();
  if (!open)
    return (
      <Button size="sm" variant={empty ? "accent" : "ghost"} className="mt-3" onClick={() => setOpen(true)}>
        <Sun className="h-4 w-4" /> {hasEntries ? "Acrescentar à história do dia" : "Conte a história deste dia"}
      </Button>
    );
  return (
    <form
      className="mt-3 space-y-3 rounded-xl border border-dashed border-sunset-400 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const story = STORY_PROMPTS.map((q, i) => ({ question: q, answer: answers[i].trim() })).filter((a) => a.answer);
        if (!story.length) return toast("Responda pelo menos uma pergunta", "error");
        await getRepo().insert("diary_entries", {
          trip_id: trip.id, date, title: title.trim() || `Dia ${index}`, body: "", location_name: "", lat: null, lng: null, author_traveler_id: null,
          rating: null, mood: "", tags: ["história"], people: [], instagrammable: false, story_answers: story, is_draft: false, base_updated_at: null,
        });
        toast("História salva no diário");
        setOpen(false);
        setAnswers(STORY_PROMPTS.map(() => ""));
        setTitle("");
      }}
    >
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Título (ex.: Dia ${index} — o gelo azul)`} aria-label="Título da história" />
      {STORY_PROMPTS.map((q, i) => (
        <label key={q} className="block text-sm">
          <span className="text-muted">{q}</span>
          <Textarea rows={2} className="mt-1 min-h-0" value={answers[i]} onChange={(e) => setAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))} />
        </label>
      ))}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
        <Button type="submit">Salvar no diário</Button>
      </div>
    </form>
  );
}
