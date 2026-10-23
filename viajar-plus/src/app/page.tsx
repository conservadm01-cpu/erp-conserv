"use client";
import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, CalendarDays, Camera, CheckCircle2, Circle, Compass, MapPin, Sparkles, Users } from "lucide-react";
import { RequireTrip } from "@/components/layout/require-trip";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBudget, useMoney } from "@/components/budget/use-budget";
import { BudgetMeter } from "@/components/budget/charts";
import { useRows } from "@/lib/data/hooks";
import { useMediaUrl } from "@/lib/media/use-media-url";
import { daysBetween, fmtDate, pct, toISODate } from "@/lib/format";
import { STATUS_LABEL, travelerCount } from "@/lib/trips/service";
import { DEMO_NOTICE } from "@/lib/demo/seed";
import { UpcomingAlerts } from "@/components/notifications/upcoming-alerts";
import type { MediaAsset, Trip } from "@/lib/types";

export default function PainelPage() {
  return <RequireTrip>{(trip) => <Dashboard trip={trip} />}</RequireTrip>;
}

function Dashboard({ trip }: { trip: Trip }) {
  const b = useBudget(trip);
  const { fmt } = useMoney(trip);
  const where = { trip_id: trip.id };
  const quotes = useRows("quotes", where);
  const media = useRows("media_assets", where);
  const edits = useRows("photo_edits", where);
  const albums = useRows("albums", where);
  const days = useRows("itinerary_days", where);
  const items = useRows("itinerary_items", where);
  const diary = useRows("diary_entries", where);

  const today = toISODate(new Date());
  const until = daysBetween(today, trip.start_date);
  const countdown = until > 0 ? `Faltam ${until} dia${until > 1 ? "s" : ""}` : today <= trip.end_date ? "Viagem em andamento" : "Viagem concluída";

  const steps = [
    { done: true, label: "Criar a viagem", href: `/viagens/${trip.id}` },
    { done: quotes.data.length > 0, label: "Adicionar uma cotação (pesquisa ou registro manual)", href: "/pesquisar" },
    { done: b.expenses.some((e) => e.quoted_amount > 0 || e.quote_id), label: "Montar o orçamento com valores cotados", href: "/orcamento" },
    { done: b.payments.length > 0, label: "Registrar um pagamento", href: "/orcamento" },
    { done: media.data.some((m) => m.kind === "image"), label: "Adicionar fotos (e contar a história de cada uma)", href: "/midia" },
    { done: edits.data.length > 0, label: "Editar uma foto (moldura, ajustes, texto)", href: "/midia" },
    { done: albums.data.length > 0, label: "Criar o book da viagem e exportar em PDF", href: "/book" },
  ];
  const nextStep = steps.find((s) => !s.done);

  const upcoming = useMemo(() => {
    const dayById = new Map(days.data.map((d) => [d.id, d]));
    return items.data
      .map((i) => ({ ...i, date: dayById.get(i.day_id)?.date ?? "" }))
      .filter((i) => i.date >= today)
      .sort((a, c) => `${a.date}${a.start_time ?? ""}`.localeCompare(`${c.date}${c.start_time ?? ""}`))
      .slice(0, 5);
  }, [days.data, items.data, today]);

  const highlights = media.data.filter((m) => m.kind === "image" && (m.favorite || m.instagrammable)).slice(0, 6);
  const recent = highlights.length ? highlights : media.data.filter((m) => m.kind === "image").slice(-6);

  return (
    <>
      <section className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-glacier-700 via-glacier-900 to-[#0b1e28] p-6 text-white md:p-10">
        <div className="absolute inset-0 opacity-40 [background:radial-gradient(circle_at_85%_15%,#ea7a32_0,transparent_40%),radial-gradient(circle_at_10%_90%,#2b8fb3_0,transparent_45%)]" aria-hidden />
        <div className="relative">
          <div className="flex flex-wrap gap-2">
            <Badge tone="blue">{STATUS_LABEL[trip.status]}</Badge>
            {trip.is_demo && <Badge tone="amber">Demonstração</Badge>}
          </div>
          <p className="mt-4 text-sm uppercase tracking-[0.25em] text-white/70">{countdown}</p>
          <h1 className="mt-1 max-w-3xl font-display text-3xl font-bold leading-tight md:text-5xl">{trip.name}</h1>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/85">
            <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" aria-hidden />{trip.destination}{trip.destination_country ? `, ${trip.destination_country}` : ""}</span>
            <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" aria-hidden />{fmtDate(trip.start_date)} → {fmtDate(trip.end_date)}</span>
            <span className="flex items-center gap-1.5"><Users className="h-4 w-4" aria-hidden />{travelerCount(trip)} viajantes · saída {trip.origin}</span>
          </div>
        </div>
      </section>

      {trip.is_demo && <Notice tone="warn" className="mb-6">{DEMO_NOTICE}</Notice>}
      {b.alerts.map((a) => (
        <Notice key={a.kind} tone={a.level === "critico" ? "error" : "warn"} className="mb-3">{a.message}</Notice>
      ))}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Orçamento" value={fmt(b.totals.budget)} />
        <Stat label="Pago" value={fmt(b.totals.realized)} hint={`${pct(b.totals.consumedPct, 1)} consumido`} />
        <Stat label="A pagar" value={fmt(b.totals.pending)} />
        <Stat label="Projeção final" value={fmt(b.totals.projected)} tone={b.totals.projectedPct > 100 ? "bad" : "default"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Saldo do orçamento" action={<LinkButton href="/orcamento" variant="outline" size="sm">Abrir orçamento</LinkButton>} />
          <CardBody><BudgetMeter realized={b.totals.realized} pending={b.totals.pending} uncommitted={b.totals.uncommitted} budget={b.totals.budget} fmt={fmt} /></CardBody>
        </Card>

        <Card>
          <CardHeader title="Seu roteiro de uso" subtitle={nextStep ? "Próximo passo sugerido" : "Fluxo completo — boa viagem!"} />
          <CardBody>
            <ol className="space-y-2 text-sm">
              {steps.map((s) => (
                <li key={s.label}>
                  <Link href={s.href} className="flex items-start gap-2 rounded-lg p-1 hover:bg-surface-2">
                    {s.done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-label="Concluído" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-label="Pendente" />}
                    <span className={s.done ? "text-muted line-through" : s === nextStep ? "font-semibold" : ""}>{s.label}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>

        <div className="lg:col-span-3"><UpcomingAlerts tripId={trip.id} /></div>

        <Card className="lg:col-span-2">
          <CardHeader title="Próximos itens do roteiro" action={<LinkButton href="/roteiro" variant="outline" size="sm">Ver roteiro</LinkButton>} />
          <CardBody>
            {!upcoming.length ? (
              <p className="text-sm text-muted">Nada agendado a partir de hoje.</p>
            ) : (
              <ul className="divide-y divide-line">
                {upcoming.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="w-28 shrink-0 text-muted">{fmtDate(i.date, { weekday: "short", day: "2-digit", month: "short" })} {i.start_time ?? ""}</span>
                    <span className="min-w-0 flex-1 truncate">{i.title}</span>
                    {i.booking_status === "sugestao" && <Badge>sugestão</Badge>}
                    {i.booking_status === "reservado" && <Badge tone="green">reservado</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Guia da viagem" />
          <CardBody className="space-y-3 text-sm">
            {trip.desired_experiences ? (
              <p className="italic text-muted">“{trip.desired_experiences.slice(0, 220)}{trip.desired_experiences.length > 220 ? "…" : ""}”</p>
            ) : (
              <p className="text-muted">Conte quais experiências vocês desejam e o guia sugere restaurantes, bares, culinária local, locais religiosos e mirantes instagramáveis.</p>
            )}
            <LinkButton href="/pesquisar" variant="accent" size="sm"><Sparkles className="h-4 w-4" /> Analisar e descobrir lugares</LinkButton>
            <LinkButton href="/passeios" variant="outline" size="sm"><Compass className="h-4 w-4" /> Passeios</LinkButton>
          </CardBody>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader
            title="Memórias"
            subtitle={`${media.data.length} arquivo(s) · ${diary.data.length} registro(s) no diário`}
            action={<><LinkButton href="/midia" variant="outline" size="sm"><Camera className="h-4 w-4" /> Fotos</LinkButton><LinkButton href="/linha-do-tempo" variant="outline" size="sm">Linha do tempo <ArrowRight className="h-4 w-4" /></LinkButton></>}
          />
          <CardBody>
            {!recent.length ? (
              <p className="text-sm text-muted">Suba as primeiras fotos — a cada imagem o VIAJAR+ faz perguntas para registrar o melhor do momento.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
                {recent.map((m) => <Thumb key={m.id} m={m} />)}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function Thumb({ m }: { m: MediaAsset }) {
  const url = useMediaUrl(m.thumb_path ?? m.storage_path);
  return (
    <Link href={`/midia/foto/${m.id}`} className="block aspect-square overflow-hidden rounded-xl bg-surface-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt={m.caption || m.original_name} className="h-full w-full object-cover transition hover:scale-105" />}
    </Link>
  );
}
