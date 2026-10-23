"use client";
import { RequireTrip } from "@/components/layout/require-trip";
import { ActivitySearch, SavedActivities } from "@/components/search/activities-panel";
import { GuidePanel } from "@/components/search/guide-panel";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/states";

export default function Page() {
  return (
    <RequireTrip>
      {(trip) => (
        <div className="space-y-6">
          <PageHeader
            eyebrow="Passeios e atividades"
            title={`O que fazer em ${trip.destination}`}
            description="Passeios pagos via fornecedor autorizado (quando configurado) e atrações, parques, museus, mirantes e locais religiosos do OpenStreetMap. Adicione ao roteiro e ao orçamento."
          />
          <Card>
            <CardHeader title="Passeios com preço" subtitle="Barcos, trilhas guiadas, experiências familiares… A disponibilidade na data é confirmada só no fornecedor." />
            <CardBody>
              <ActivitySearch trip={trip} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Atrações e lugares (OpenStreetMap)" subtitle="“Sem ingresso” só aparece quando o mapa informa — transporte e taxas não estão incluídos." />
            <CardBody>
              <GuidePanel trip={trip} initialCategory="atracao" />
            </CardBody>
          </Card>
          <SavedActivities trip={trip} />
        </div>
      )}
    </RequireTrip>
  );
}
