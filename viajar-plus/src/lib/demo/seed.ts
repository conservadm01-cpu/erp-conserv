import { getRepo } from "@/lib/data";
import { createTrip } from "@/lib/trips/service";
import type { Trip } from "@/lib/types";

export const DEMO_NOTICE = "Dados de demonstração: valores são estimativas fictícias para ilustrar o sistema e NÃO são cotações reais.";
const DISMISS_KEY = "viajar:demo-dismissed";

/** Cria a viagem demonstrativa El Calafate (somente no modo local e uma única vez). */
export async function ensureDemoTrip(): Promise<Trip | null> {
  const repo = getRepo();
  if (repo.mode !== "local") return null;
  try {
    if (localStorage.getItem(DISMISS_KEY)) return null;
  } catch {
    /* sem localStorage */
  }
  const existing = await repo.list("trips");
  if (existing.length) return null;
  return seedDemoTrip();
}

export function dismissDemo(): void {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* ignore */
  }
}

export async function seedDemoTrip(): Promise<Trip> {
  const repo = getRepo();
  const trip = await createTrip(
    {
      name: "Patagônia em família — El Calafate (DEMONSTRAÇÃO)",
      destination: "El Calafate",
      destination_country: "Argentina",
      origin: "São Paulo — Guarulhos (GRU)",
      start_date: "2026-12-10",
      end_date: "2026-12-15",
      adults: 4,
      children: 1,
      children_ages: [8],
      currency: "BRL",
      budget_total: 40000,
      budget_per_person: 8000,
      transport_prefs: ["aviao", "carro_alugado"],
      lodging_prefs: ["apartamento"],
      activity_prefs: ["natureza", "glaciares", "gastronomia", "fotografia", "familia"],
      pace: "moderado",
      accessibility: "",
      restrictions: "Criança de 8 anos: verificar idade mínima dos passeios de trekking no gelo.",
      notes: DEMO_NOTICE,
      desired_experiences:
        "Queremos ver o Glaciar Perito Moreno de perto, navegar entre icebergs, provar o cordeiro patagônico e um bom chocolate quente, conhecer uma igreja ou capela local e tirar fotos incríveis no pôr do sol do Lago Argentino. Ritmo tranquilo por causa da criança.",
      status: "planejando",
    },
    { isDemo: true, travelerNames: ["Ana", "Bruno", "Carla", "Diego", "Lia"] },
  );
  await repo.update("trips", trip.id, { destination_lat: -50.3379, destination_lng: -72.2648 });

  const demoNote = "Estimativa fictícia de demonstração — não é cotação real.";
  const planned: [string, string, number][] = [
    ["passagens", "Voos GRU ⇄ FTE (5 passageiros)", 17500],
    ["bagagem_aeroporto", "Transporte até Guarulhos e bagagem despachada", 900],
    ["hospedagem", "Apartamento tipo Airbnb — 5 noites", 6000],
    ["carro", "Carro alugado SUV 7 lugares — 5 diárias", 3500],
    ["carro", "Combustível e estacionamento", 900],
    ["passeios", "Passarelas do Perito Moreno — ingressos do parque", 1500],
    ["passeios", "Navegação pelos glaciares", 3000],
    ["alimentacao", "Refeições e mercado", 4000],
    ["seguro", "Seguro viagem para 5 pessoas", 600],
    ["internet", "Chip/eSIM de dados", 200],
    ["emergencias", "Reserva para imprevistos", 1500],
  ];
  await repo.insertMany(
    "expenses",
    planned.map(([category_key, description, amount]) => ({
      trip_id: trip.id,
      category_key,
      description,
      supplier: "",
      quantity: 1,
      unit_price: 0,
      original_currency: "BRL",
      fx_rate: 1,
      fees: 0,
      planned_amount: amount,
      quoted_amount: 0,
      reserved_amount: 0,
      due_date: null,
      responsible_traveler_id: null,
      status: "previsto" as const,
      receipt_document_id: null,
      notes: demoNote,
      split_mode: "todos" as const,
      split: {},
      quote_id: null,
      reservation_id: null,
      diary_entry_id: null,
      incurred_on: null,
    })),
  );

  const days = (await repo.list("itinerary_days", { trip_id: trip.id })).sort((a, b) => a.date.localeCompare(b.date));
  const plan: [number, string, string, string, number, string][] = [
    [0, "Chegada a El Calafate e retirada do carro", "deslocamento", "15:00", 90, "Aeroporto Internacional de El Calafate (FTE)"],
    [0, "Reserva Natural Laguna Nimez (observação de aves)", "passeio", "17:30", 90, "Laguna Nimez, El Calafate"],
    [1, "Glaciar Perito Moreno — passarelas", "passeio", "09:00", 300, "Parque Nacional Los Glaciares"],
    [2, "Navegação pelos glaciares (verificar idade mínima)", "passeio", "08:30", 420, "Puerto Punta Bandera"],
    [3, "Bate-volta a El Chaltén (≈ 3h de estrada por trecho)", "passeio", "07:00", 600, "El Chaltén"],
    [4, "Glaciarium — museu do gelo", "passeio", "10:30", 120, "Glaciarium, El Calafate"],
    [4, "Pôr do sol no Lago Argentino (fotos)", "passeio", "20:30", 60, "Costanera, El Calafate"],
    [5, "Devolução do carro e voo de volta", "voo", "11:00", 120, "Aeroporto Internacional de El Calafate (FTE)"],
  ];
  await repo.insertMany(
    "itinerary_items",
    plan
      .filter(([d]) => days[d])
      .map(([d, title, kind, start_time, duration_min, address], i) => ({
        trip_id: trip.id,
        day_id: days[d].id,
        title,
        kind: kind as "passeio",
        start_time,
        duration_min,
        address,
        lat: null,
        lng: null,
        cost_estimate: 0,
        currency: "BRL",
        travel_min_from_prev: null,
        opening_hours: "",
        notes: "Sugestão de demonstração — confirmar horários e disponibilidade com o fornecedor.",
        booking_status: "sugestao" as const,
        reservation_id: null,
        activity_id: null,
        position: i,
      })),
  );
  return trip;
}
