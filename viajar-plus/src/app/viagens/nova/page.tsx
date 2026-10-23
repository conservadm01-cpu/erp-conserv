"use client";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/states";
import { TripForm, EMPTY_TRIP } from "@/components/trips/trip-form";
import { createTrip } from "@/lib/trips/service";
import { useTrip } from "@/lib/trips/context";
import { useToast } from "@/components/ui/toast";

export default function NovaViagemPage() {
  const router = useRouter();
  const { select } = useTrip();
  const toast = useToast();
  return (
    <>
      <PageHeader eyebrow="Nova viagem" title="Para onde vamos?" description="Comece pelo básico. Orçamento, roteiro, viajantes e categorias são criados automaticamente." />
      <TripForm
        initial={EMPTY_TRIP}
        submitLabel="Criar viagem"
        onSubmit={async (v) => {
          try {
            const t = await createTrip(v);
            select(t.id);
            toast("Viagem criada!");
            router.push(`/viagens/${t.id}`);
          } catch (e) {
            toast(e instanceof Error ? e.message : "Erro ao criar viagem", "error");
          }
        }}
      />
    </>
  );
}
