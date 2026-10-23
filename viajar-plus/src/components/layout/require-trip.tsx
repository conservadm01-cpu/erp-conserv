"use client";
import type { ReactNode } from "react";
import { Luggage } from "lucide-react";
import { useTrip } from "@/lib/trips/context";
import { EmptyState, Loading } from "@/components/ui/states";
import { LinkButton } from "@/components/ui/button";
import type { Trip } from "@/lib/types";

/** Renderiza o conteúdo somente quando há uma viagem ativa; senão orienta a criar uma. */
export function RequireTrip({ children }: { children: (trip: Trip) => ReactNode }) {
  const { trip, loading, error } = useTrip();
  if (loading && !trip) return <Loading label="Carregando viagem…" />;
  if (error) return <EmptyState title="Não foi possível carregar suas viagens">{error}</EmptyState>;
  if (!trip)
    return (
      <EmptyState icon={<Luggage />} title="Nenhuma viagem ainda" action={<LinkButton href="/viagens/nova">Criar minha primeira viagem</LinkButton>}>
        Crie uma viagem para montar orçamento, roteiro, diário e álbum.
      </EmptyState>
    );
  return <>{children(trip)}</>;
}
