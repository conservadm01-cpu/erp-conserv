"use client";
import { useParams, useRouter } from "next/navigation";
import { useRow } from "@/lib/data/hooks";
import { PageHeader, Loading, EmptyState, Notice } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { Button, LinkButton } from "@/components/ui/button";
import { TripForm } from "@/components/trips/trip-form";
import { TravelersPanel } from "@/components/trips/travelers-panel";
import { MembersPanel } from "@/components/trips/members-panel";
import { deleteTrip, updateTrip, STATUS_LABEL } from "@/lib/trips/service";
import { useTrip } from "@/lib/trips/context";
import { useToast } from "@/components/ui/toast";
import { fmtDate } from "@/lib/format";
import { DEMO_NOTICE } from "@/lib/demo/seed";
import type { TripInput } from "@/lib/schemas";

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: trip, loading } = useRow("trips", id);
  const { select } = useTrip();
  const router = useRouter();
  const toast = useToast();

  if (loading && !trip) return <Loading />;
  if (!trip) return <EmptyState title="Viagem não encontrada" action={<LinkButton href="/viagens">Voltar</LinkButton>}>Ela pode ter sido excluída ou você não tem acesso.</EmptyState>;

  const initial: TripInput = {
    name: trip.name, destination: trip.destination, destination_country: trip.destination_country, origin: trip.origin,
    start_date: trip.start_date, end_date: trip.end_date, adults: trip.adults, children: trip.children, children_ages: trip.children_ages ?? [],
    currency: trip.currency, budget_total: trip.budget_total, budget_per_person: trip.budget_per_person,
    transport_prefs: trip.transport_prefs ?? [], lodging_prefs: trip.lodging_prefs ?? [], activity_prefs: trip.activity_prefs ?? [],
    pace: trip.pace, accessibility: trip.accessibility, restrictions: trip.restrictions, notes: trip.notes,
    desired_experiences: trip.desired_experiences, status: trip.status,
  };

  return (
    <>
      <PageHeader
        eyebrow={`${STATUS_LABEL[trip.status]} · ${fmtDate(trip.start_date)} → ${fmtDate(trip.end_date)}`}
        title={trip.name}
        description={`${trip.origin} → ${trip.destination}`}
        actions={<Button variant="outline" onClick={() => { select(trip.id); router.push("/"); }}>Abrir painel</Button>}
      />
      {trip.is_demo && <Notice tone="warn" className="mb-4">{DEMO_NOTICE}</Notice>}
      <Tabs
        tabs={[
          {
            value: "dados",
            label: "Dados da viagem",
            content: (
              <TripForm
                key={trip.updated_at}
                initial={initial}
                submitLabel="Salvar alterações"
                onSubmit={async (v) => {
                  try {
                    await updateTrip(trip.id, v);
                    toast("Viagem atualizada");
                  } catch (e) {
                    toast(e instanceof Error ? e.message : String(e), "error");
                  }
                }}
              />
            ),
          },
          { value: "viajantes", label: "Viajantes e responsáveis", content: <TravelersPanel trip={trip} /> },
          { value: "participantes", label: "Participantes e convites", content: <MembersPanel trip={trip} /> },
          {
            value: "excluir",
            label: "Excluir",
            content: (
              <div className="space-y-3">
                <Notice tone="error" title="Excluir viagem">Remove a viagem, orçamento, reservas, diário, fotos, vídeos e documentos. Esta ação não pode ser desfeita. Exporte antes em Relatórios ou Configurações → Privacidade, se quiser guardar.</Notice>
                <Button
                  variant="danger"
                  onClick={async () => {
                    if (prompt(`Digite EXCLUIR para apagar "${trip.name}"`) !== "EXCLUIR") return;
                    await deleteTrip(trip.id);
                    select(null);
                    toast("Viagem excluída");
                    router.push("/viagens");
                  }}
                >
                  Excluir definitivamente
                </Button>
              </div>
            ),
          },
        ]}
      />
    </>
  );
}
