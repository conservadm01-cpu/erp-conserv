"use client";
import Link from "next/link";
import { CalendarDays, MapPin, Plus, Users, Luggage } from "lucide-react";
import { useTrip } from "@/lib/trips/context";
import { PageHeader, EmptyState, Loading } from "@/components/ui/states";
import { LinkButton, Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtDate, money } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/trips/service";
import { seedDemoTrip } from "@/lib/demo/seed";
import { dataMode } from "@/lib/data";
import { useToast } from "@/components/ui/toast";

const tone = { planejando: "blue", reservada: "violet", em_andamento: "orange", concluida: "green" } as const;

export default function ViagensPage() {
  const { trips, loading, select, trip: active } = useTrip();
  const toast = useToast();
  return (
    <>
      <PageHeader
        eyebrow="Minhas viagens"
        title="Cada viagem, uma história"
        actions={
          <>
            {dataMode() === "local" && (
              <Button variant="outline" onClick={() => seedDemoTrip().then((t) => { select(t.id); toast("Viagem demonstrativa criada"); })}>
                Recriar demonstração
              </Button>
            )}
            <LinkButton href="/viagens/nova"><Plus className="h-4 w-4" /> Nova viagem</LinkButton>
          </>
        }
      />
      {loading && !trips.length ? (
        <Loading />
      ) : !trips.length ? (
        <EmptyState icon={<Luggage />} title="Nenhuma viagem cadastrada" action={<LinkButton href="/viagens/nova">Criar viagem</LinkButton>}>
          Cadastre destino, datas e viajantes para começar.
        </EmptyState>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {trips.map((t) => (
            <article key={t.id} className="group overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition hover:shadow-md">
              <div className="relative h-32 bg-gradient-to-br from-glacier-500 via-glacier-700 to-glacier-900 p-4 text-white">
                <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_80%_20%,#ea7a32_0,transparent_45%)]" aria-hidden />
                <div className="relative flex items-start justify-between gap-2">
                  <Badge tone={tone[t.status]}>{STATUS_LABEL[t.status]}</Badge>
                  {t.is_demo && <Badge tone="amber">Demonstração</Badge>}
                </div>
                <h2 className="relative mt-3 line-clamp-2 font-display text-xl font-bold leading-tight">{t.name}</h2>
              </div>
              <div className="space-y-2 p-4 text-sm">
                <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted" aria-hidden /> {t.destination}{t.destination_country ? `, ${t.destination_country}` : ""}</p>
                <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-muted" aria-hidden /> {fmtDate(t.start_date)} → {fmtDate(t.end_date)}</p>
                <p className="flex items-center gap-2"><Users className="h-4 w-4 text-muted" aria-hidden /> {t.adults} adulto(s){t.children ? `, ${t.children} criança(s)` : ""}</p>
                <p className="text-muted">Orçamento: <strong className="text-fg">{money(t.budget_total, t.currency)}</strong></p>
                <div className="flex gap-2 pt-2">
                  <Link href={`/viagens/${t.id}`} className="text-accent hover:underline" onClick={() => select(t.id)}>Detalhes</Link>
                  {active?.id !== t.id ? (
                    <button className="text-muted hover:text-fg" onClick={() => select(t.id)}>Tornar ativa</button>
                  ) : (
                    <span className="text-xs text-emerald-600">● ativa</span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
