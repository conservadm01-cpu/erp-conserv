"use client";
import { useState } from "react";
import { Trash2, UserPlus } from "lucide-react";
import { getRepo } from "@/lib/data";
import { useRows } from "@/lib/data/hooks";
import type { Traveler, Trip } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

/** Viajantes (participantes do rateio) e seus responsáveis/funções. */
export function TravelersPanel({ trip }: { trip: Trip }) {
  const { data: travelers } = useRows("travelers", { trip_id: trip.id });
  const toast = useToast();
  const [name, setName] = useState("");

  const save = (t: Traveler, patch: Partial<Traveler>) => getRepo().update("travelers", t.id, patch).catch((e) => toast(String(e), "error"));

  async function syncCounts() {
    const list = await getRepo().list("travelers", { trip_id: trip.id });
    const adults = list.filter((t) => t.kind === "adulto").length;
    const kids = list.filter((t) => t.kind === "crianca");
    await getRepo().update("trips", trip.id, { adults: Math.max(1, adults), children: kids.length, children_ages: kids.map((k) => k.age ?? 0) });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Os viajantes são usados no rateio de despesas, no diário e nas fotos. Alterar aqui atualiza o número de adultos/crianças da viagem.</p>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {travelers.map((t) => (
          <li key={t.id} className="grid gap-2 p-3 sm:grid-cols-[1fr_130px_90px_1fr_auto] sm:items-center">
            <Input aria-label="Nome" defaultValue={t.name} onBlur={(e) => e.target.value !== t.name && save(t, { name: e.target.value })} />
            <Select aria-label="Tipo" defaultValue={t.kind} onChange={(e) => save(t, { kind: e.target.value as Traveler["kind"] }).then(syncCounts)}>
              <option value="adulto">Adulto</option>
              <option value="crianca">Criança</option>
            </Select>
            <Input aria-label="Idade" type="number" min={0} max={120} placeholder="Idade" defaultValue={t.age ?? ""} onBlur={(e) => save(t, { age: e.target.value ? Number(e.target.value) : null }).then(syncCounts)} />
            <Input aria-label="Responsabilidades" placeholder="Responsável por… (ex.: carro, reservas)" defaultValue={t.responsibilities} onBlur={(e) => save(t, { responsibilities: e.target.value })} />
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Remover ${t.name}`}
              onClick={async () => {
                if (!confirm(`Remover ${t.name}? Rateios personalizados com essa pessoa deixarão de considerá-la.`)) return;
                await getRepo().remove("travelers", t.id);
                await syncCounts();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (name.trim().length < 2) return;
          await getRepo().insert("travelers", { trip_id: trip.id, name: name.trim(), kind: "adulto", age: null, member_id: null, responsibilities: "" });
          await syncCounts();
          setName("");
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do viajante" aria-label="Nome do novo viajante" />
        <Button type="submit" variant="outline"><UserPlus className="h-4 w-4" /> Adicionar</Button>
      </form>
    </div>
  );
}
