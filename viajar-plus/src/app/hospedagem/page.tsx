"use client";
import { RequireTrip } from "@/components/layout/require-trip";
import { LodgingSearch } from "@/components/search/lodging-search";
import { ManualQuoteForm } from "@/components/search/manual-quote-form";
import { QuotesPanel } from "@/components/search/quotes-panel";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Notice, PageHeader } from "@/components/ui/states";

export default function Page() {
  return (
    <RequireTrip>
      {(trip) => (
        <div className="space-y-6">
          <PageHeader
            eyebrow="Hospedagem"
            title={`Onde ficar em ${trip.destination}`}
            description="Hotéis via API autorizada (quando configurada); apartamentos e casas por links oficiais de pesquisa. Nunca afirmamos disponibilidade sem confirmação da fonte."
          />
          <Notice tone="info" title="Airbnb e imóveis por temporada">
            O Airbnb não oferece API pública: usamos apenas o link de pesquisa, sem coletar dados do site. Registre abaixo o preço que encontrar.
          </Notice>
          <LodgingSearch trip={trip} />
          <Card>
            <CardHeader title="Registrar cotação de hospedagem" subtitle="Preço total da estadia, taxas, café, cozinha, estacionamento, cancelamento e avaliação vistos no site." />
            <CardBody>
              <ManualQuoteForm trip={trip} defaultType="hospedagem" lockType />
            </CardBody>
          </Card>
          <section>
            <h2 className="mb-3 font-display text-xl font-semibold">Cotações de hospedagem</h2>
            <QuotesPanel trip={trip} only="hospedagem" />
          </section>
        </div>
      )}
    </RequireTrip>
  );
}
