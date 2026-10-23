import { getFiles, getRepo } from "@/lib/data";
import { defaultCategoryRows } from "@/lib/budget/categories";
import { dateRange, fmtDate } from "@/lib/format";
import type { ID, MemberPermissions, MemberRole, NewRow, TableName, Trip } from "@/lib/types";
import type { TripInput } from "@/lib/schemas";

export const ROLE_PERMISSIONS: Record<MemberRole, MemberPermissions> = {
  proprietario: { edit_trip: true, budget: true, reservations: true, diary: true, media: true },
  editor: { edit_trip: true, budget: true, reservations: true, diary: true, media: true },
  financeiro: { edit_trip: false, budget: true, reservations: true, diary: false, media: false },
  colaborador: { edit_trip: false, budget: false, reservations: false, diary: true, media: true },
  leitor: { edit_trip: false, budget: false, reservations: false, diary: false, media: false },
};

export const ROLE_LABEL: Record<MemberRole, string> = {
  proprietario: "Proprietário",
  editor: "Editor",
  financeiro: "Financeiro",
  colaborador: "Colaborador (diário e fotos)",
  leitor: "Somente leitura",
};

export const STATUS_LABEL: Record<Trip["status"], string> = {
  planejando: "Planejando",
  reservada: "Reservada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
};

/** Cria a viagem com tudo que ela precisa para funcionar: orçamento, categorias, viajantes, dias do roteiro e o dono como membro. */
export async function createTrip(input: TripInput, opts: { isDemo?: boolean; travelerNames?: string[] } = {}): Promise<Trip> {
  const repo = getRepo();
  const owner = await repo.currentUserId();
  if (!owner) throw new Error("Faça login para criar uma viagem.");
  const trip = await repo.insert("trips", {
    ...input,
    owner_id: owner,
    destination_lat: null,
    destination_lng: null,
    cover_media_id: null,
    is_demo: Boolean(opts.isDemo),
  });
  await repo.insert("trip_members", {
    trip_id: trip.id,
    user_id: owner,
    name: "Você",
    email: "",
    role: "proprietario",
    permissions: ROLE_PERMISSIONS.proprietario,
    invite_status: "aceito",
    invite_token: null,
  });
  await repo.insert("budgets", {
    trip_id: trip.id,
    total: input.budget_total,
    currency: input.currency,
    alert_thresholds: [70, 90, 100],
    days_considered: null,
    per_traveler_basis: "projecao",
  });
  await repo.insertMany("budget_categories", defaultCategoryRows(trip.id));
  const names = opts.travelerNames ?? [];
  const travelers: NewRow<"travelers">[] = [];
  for (let i = 0; i < input.adults; i++) {
    travelers.push({ trip_id: trip.id, name: names[i] ?? `Adulto ${i + 1}`, kind: "adulto", age: null, member_id: null, responsibilities: "" });
  }
  input.children_ages.forEach((age, i) => {
    travelers.push({ trip_id: trip.id, name: names[input.adults + i] ?? `Criança ${i + 1}`, kind: "crianca", age, member_id: null, responsibilities: "" });
  });
  await repo.insertMany("travelers", travelers);
  await repo.insertMany(
    "itinerary_days",
    dateRange(input.start_date, input.end_date).map((date, i) => ({ trip_id: trip.id, date, title: `Dia ${i + 1} · ${fmtDate(date, { weekday: "short", day: "2-digit", month: "short" })}`, notes: "" })),
  );
  return trip;
}

/** Atualiza a viagem e mantém orçamento e dias do roteiro coerentes com as novas datas/valores. */
export async function updateTrip(id: ID, input: TripInput): Promise<Trip> {
  const repo = getRepo();
  const trip = await repo.update("trips", id, input);
  const [budget] = await repo.list("budgets", { trip_id: id });
  if (budget) await repo.update("budgets", budget.id, { total: input.budget_total, currency: input.currency });
  const days = await repo.list("itinerary_days", { trip_id: id });
  const have = new Set(days.map((d) => d.date));
  const missing = dateRange(input.start_date, input.end_date).filter((d) => !have.has(d));
  if (missing.length) {
    await repo.insertMany(
      "itinerary_days",
      missing.map((date) => ({ trip_id: id, date, title: fmtDate(date, { weekday: "short", day: "2-digit", month: "short" }), notes: "" })),
    );
  }
  return trip;
}

const CHILD_TABLES: TableName[] = [
  "album_pages", "albums", "video_projects", "photo_edits", "media_assets", "diary_entries", "documents",
  "payments", "expenses", "reservations", "itinerary_items", "itinerary_days", "activities", "quotes",
  "search_queries", "budget_categories", "budgets", "travelers", "destinations", "trip_members", "notifications",
];

/** Exclui a viagem, seus registros e arquivos (no Supabase as FKs também fazem cascata). */
export async function deleteTrip(id: ID): Promise<void> {
  const repo = getRepo();
  const files = getFiles();
  const media = await repo.list("media_assets", { trip_id: id });
  const edits = await repo.list("photo_edits", { trip_id: id });
  const docs = await repo.list("documents", { trip_id: id });
  await files.remove("media", [...media.flatMap((m) => [m.storage_path, m.thumb_path ?? ""]), ...edits.map((e) => e.output_path)].filter(Boolean));
  await files.remove("documents", docs.map((d) => d.storage_path));
  if (repo.mode === "local") {
    for (const t of CHILD_TABLES) {
      const rows = await repo.list(t, { trip_id: id } as never);
      for (const r of rows) await repo.remove(t, r.id);
    }
  }
  await repo.remove("trips", id);
}

export function travelerCount(t: Pick<Trip, "adults" | "children">): number {
  return (t.adults || 0) + (t.children || 0);
}
