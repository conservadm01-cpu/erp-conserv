"use client";
import { RequireTrip } from "@/components/layout/require-trip";
import { CarCapacityCheck, CarSearch } from "@/components/search/car-search";
import { ManualQuoteForm } from "@/components/search/manual-quote-form";
import { QuotesPanel } from "@/components/search/quotes-panel";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/states";

export default function Page() {
  return (
    <RequireTrip>
      {(trip) => (
        <div className="space-y-6">
          <PageHeader
            eyebrow="Locação de veículos"
            title={`Carro em ${trip.destination}`}
            description="Não existe API pública autorizada de locadoras integrada: pesquise nos sites (links com datas preenchidas) e registre a cotação com todos os detalhes para comparar."
          />
          <CarSearch trip={trip} />
          <Card>
            <CardHeader title="Registrar cotação de carro" subtitle="Preço total, taxas, caução, seguro, franquia, combustível, quilometragem, cancelamento, motorista adicional e habilitação." />
            <CardBody>
              <ManualQuoteForm trip={trip} defaultType="carro" lockType />
            </CardBody>
          </Card>
          <CarCapacityCheck trip={trip} />
          <section>
            <h2 className="mb-3 font-display text-xl font-semibold">Cotações de carro</h2>
            <QuotesPanel trip={trip} only="carro" />
          </section>
        </div>
      )}
    </RequireTrip>
  );
}
