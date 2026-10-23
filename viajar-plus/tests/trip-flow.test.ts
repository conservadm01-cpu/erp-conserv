import { beforeEach, describe, expect, it } from "vitest";
import { getFiles, getRepo } from "@/lib/data";
import { resetLocalDb } from "@/lib/data/local";
import { createTrip, deleteTrip, updateTrip } from "@/lib/trips/service";
import { seedDemoTrip } from "@/lib/demo/seed";
import { computeTotals, perTraveler } from "@/lib/budget/calc";
import { budgetCSV } from "@/lib/budget/export";
import { tripSchema, type TripInput } from "@/lib/schemas";

const input: TripInput = tripSchema.parse({
  name: "Teste Patagônia",
  destination: "El Calafate",
  destination_country: "Argentina",
  origin: "GRU",
  start_date: "2026-12-10",
  end_date: "2026-12-15",
  adults: 4,
  children: 1,
  children_ages: [8],
  currency: "BRL",
  budget_total: 40000,
  budget_per_person: 8000,
  pace: "moderado",
  status: "planejando",
});

describe("fluxo principal da viagem (modo local)", () => {
  beforeEach(async () => {
    await resetLocalDb();
  });

  it("valida o cadastro da viagem", () => {
    expect(tripSchema.safeParse({ ...input, end_date: "2026-12-01" }).success).toBe(false);
    expect(tripSchema.safeParse({ ...input, children: 2, children_ages: [8] }).success).toBe(false);
    expect(tripSchema.safeParse({ ...input, adults: 0 }).success).toBe(false);
  });

  it("cria viagem com orçamento, categorias, viajantes, dias e dono", async () => {
    const trip = await createTrip(input);
    const repo = getRepo();
    const where = { trip_id: trip.id };
    expect((await repo.list("budgets", where))[0].total).toBe(40000);
    expect(await repo.list("budget_categories", where)).toHaveLength(13);
    const travelers = await repo.list("travelers", where);
    expect(travelers).toHaveLength(5);
    expect(travelers.filter((t) => t.kind === "crianca")[0].age).toBe(8);
    expect(await repo.list("itinerary_days", where)).toHaveLength(6);
    expect((await repo.list("trip_members", where))[0].role).toBe("proprietario");

    await updateTrip(trip.id, { ...input, end_date: "2026-12-17", budget_total: 45000 });
    expect(await repo.list("itinerary_days", where)).toHaveLength(8);
    expect((await repo.list("budgets", where))[0].total).toBe(45000);
  });

  it("cotação → orçamento → reserva → pagamento parcial → totais e exportação", async () => {
    const trip = await createTrip(input);
    const repo = getRepo();
    const travelers = await repo.list("travelers", { trip_id: trip.id });
    const quote = await repo.insert("quotes", {
      trip_id: trip.id, type: "hospedagem", title: "Apartamento 3 quartos", provider_name: "Registro manual", source: "manual",
      url: "https://example.com", total_price: 1200, currency: "USD", fx_rate: 5.4, travelers_count: 5, units: 5,
      captured_at: "2026-10-20T10:00:00.000Z", valid_until: null, search_key: "hosp-calafate", details: {}, status: "ativa", expense_id: null, notes: "",
    });
    const exp = await repo.insert("expenses", {
      trip_id: trip.id, category_key: "hospedagem", description: quote.title, supplier: quote.provider_name, quantity: 1, unit_price: 1200,
      original_currency: "USD", fx_rate: 5.4, fees: 0, planned_amount: 6000, quoted_amount: 6480, reserved_amount: 0, due_date: "2026-11-10",
      responsible_traveler_id: travelers[0].id, status: "previsto", receipt_document_id: null, notes: "", split_mode: "todos", split: {},
      quote_id: quote.id, reservation_id: null, diary_entry_id: null, incurred_on: null,
    });
    await repo.update("quotes", quote.id, { status: "convertida", expense_id: exp.id });

    let t = computeTotals(await repo.list("expenses", { trip_id: trip.id }), [], 40000);
    expect(t.quoted).toBe(6480);
    expect(t.realized).toBe(0);
    expect(t.projected).toBe(6480);

    await repo.update("expenses", exp.id, { reserved_amount: 6480 });
    await repo.insert("payments", {
      trip_id: trip.id, expense_id: exp.id, kind: "pagamento", amount: 600, currency: "USD", fx_rate: 5.5, paid_at: "2026-10-21",
      payer_traveler_id: travelers[0].id, method: "cartao", notes: "", receipt_document_id: null,
    });
    const expenses = await repo.list("expenses", { trip_id: trip.id });
    const payments = await repo.list("payments", { trip_id: trip.id });
    t = computeTotals(expenses, payments, 40000);
    expect(t.realized).toBe(3300);
    expect(t.pending).toBe(3180);
    expect(t.projected).toBe(6480);
    const shares = perTraveler(expenses, payments, travelers, "realizado");
    expect(shares.reduce((s, x) => s + x.share, 0)).toBeCloseTo(3300, 2);
    expect(shares[0].balance).toBeCloseTo(3300 - 660, 2);

    const csv = budgetCSV({ trip, budgetTotal: 40000, expenses, payments, categories: await repo.list("budget_categories", { trip_id: trip.id }), travelers });
    expect(csv).toContain("Apartamento 3 quartos");
    expect(csv).toContain("3300");
  });

  it("excluir a viagem remove registros e arquivos", async () => {
    const trip = await createTrip(input);
    const repo = getRepo();
    await getFiles().put("media", `${trip.id}/a.jpg`, new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])]), trip.id);
    await repo.insert("media_assets", {
      trip_id: trip.id, kind: "image", storage_path: `${trip.id}/a.jpg`, thumb_path: null, original_name: "a.jpg", mime_type: "image/jpeg", size_bytes: 4,
      width: null, height: null, duration_sec: null, taken_at: null, lat: null, lng: null, caption: "", tags: [], people: [], album: "", favorite: false,
      instagrammable: false, diary_entry_id: null, story_answers: [],
    });
    await deleteTrip(trip.id);
    expect(await repo.get("trips", trip.id)).toBeNull();
    expect(await repo.list("travelers", { trip_id: trip.id })).toHaveLength(0);
    expect(await repo.list("media_assets", { trip_id: trip.id })).toHaveLength(0);
    expect(await getFiles().get("media", `${trip.id}/a.jpg`)).toBeNull();
  });

  it("viagem demonstrativa El Calafate sem preços apresentados como cotação real", async () => {
    const trip = await seedDemoTrip();
    expect(trip.is_demo).toBe(true);
    expect(trip.start_date).toBe("2026-12-10");
    expect(trip.adults).toBe(4);
    expect(trip.children_ages).toEqual([8]);
    const repo = getRepo();
    const expenses = await repo.list("expenses", { trip_id: trip.id });
    expect(expenses.length).toBeGreaterThan(5);
    expect(expenses.every((e) => e.quoted_amount === 0 && e.reserved_amount === 0)).toBe(true);
    expect(expenses.every((e) => /não é cotação/.test(e.notes))).toBe(true);
    expect(await repo.list("quotes", { trip_id: trip.id })).toHaveLength(0);
    expect(await repo.list("payments", { trip_id: trip.id })).toHaveLength(0);
  });
});
