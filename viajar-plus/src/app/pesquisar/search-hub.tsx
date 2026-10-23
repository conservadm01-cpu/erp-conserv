"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { RequireTrip } from "@/components/layout/require-trip";
import { ExperiencePanel } from "@/components/search/experience-panel";
import { FlightSearch } from "@/components/search/flight-search";
import { GuidePanel } from "@/components/search/guide-panel";
import { ManualQuoteForm } from "@/components/search/manual-quote-form";
import { QuotesPanel } from "@/components/search/quotes-panel";
import { WeatherFxPanel } from "@/components/search/weather-fx-panel";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { PLACE_CATEGORIES, type PlaceCategory } from "@/lib/providers/types";

const TABS = ["voos", "cotacoes", "guia", "experiencias", "clima"] as const;
type Tab = (typeof TABS)[number];

export function SearchHub() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = (TABS as readonly string[]).includes(params.get("aba") ?? "") ? (params.get("aba") as Tab) : "voos";
  const catParam = params.get("cat");
  const cat = (PLACE_CATEGORIES as readonly string[]).includes(catParam ?? "") ? (catParam as PlaceCategory) : undefined;

  const go = useCallback(
    (aba: string, extra: Record<string, string> = {}) => {
      const q = new URLSearchParams({ aba, ...extra });
      router.replace(`/pesquisar?${q}`, { scroll: false });
    },
    [router],
  );

  return (
    <RequireTrip>
      {(trip) => (
        <>
          <PageHeader
            eyebrow="Central de pesquisa"
            title={`Pesquisar para ${trip.destination}`}
            description="Voos, comparação de cotações, guia gastronômico e cultural, análise das experiências desejadas, clima e câmbio. Sem preços inventados: tudo mostra fonte e horário da consulta."
          />
          <Tabs
            value={tab}
            onValueChange={(v) => go(v)}
            tabs={[
              { value: "voos", label: "Voos", content: <FlightSearch trip={trip} /> },
              {
                value: "cotacoes",
                label: "Comparador e cotações",
                content: (
                  <div className="space-y-4">
                    <QuotesPanel trip={trip} />
                    <Card>
                      <CardHeader title="Registrar preço visto em um site" subtitle="Para fornecedores sem API: guarde fonte, URL, data e hora da consulta." />
                      <CardBody>
                        <ManualQuoteForm trip={trip} />
                      </CardBody>
                    </Card>
                  </div>
                ),
              },
              { value: "guia", label: "Guia local", content: <GuidePanel trip={trip} initialCategory={cat} /> },
              { value: "experiencias", label: "Experiências desejadas", content: <ExperiencePanel trip={trip} onExplore={(c) => go("guia", { cat: c })} /> },
              { value: "clima", label: "Clima e câmbio", content: <WeatherFxPanel trip={trip} /> },
            ]}
          />
        </>
      )}
    </RequireTrip>
  );
}
