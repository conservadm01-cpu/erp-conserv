import { itemFigures } from "@/lib/budget/calc";
import type { Expense, ItineraryDay, ItineraryItem, Payment, Reservation } from "@/lib/types";

// Gera alertas a partir de reservas, vencimentos do orçamento e horários do roteiro.
// Função pura: o "agora" e as antecedências são parâmetros.

export type AlertKind = "checkin" | "checkout" | "inicio" | "cancelamento" | "vencimento" | "horario";

export interface UpcomingAlert {
  key: string; // estável, usado para marcar como lido
  kind: AlertKind;
  title: string;
  body: string;
  due_at: string; // ISO
  ref: string; // "reservation:<id>" | "expense:<id>" | "itinerary:<id>"
  overdue: boolean;
  href: string;
}

export interface AlertOptions {
  now?: Date;
  /** Janela de antecedência em horas, por tipo. */
  leadHours?: Partial<Record<AlertKind, number>>;
  /** Incluir itens vencidos nos últimos N dias. */
  overdueDays?: number;
}

export const DEFAULT_LEAD_HOURS: Record<AlertKind, number> = {
  checkin: 72,
  checkout: 24,
  inicio: 48,
  cancelamento: 24 * 7,
  vencimento: 24 * 10,
  horario: 24,
};

const KIND_LABEL: Record<Reservation["type"], string> = { voo: "Voo", hospedagem: "Hospedagem", carro: "Carro", passeio: "Passeio", outro: "Reserva" };

function localDateTime(date: string, time: string | null): Date {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  const [hh, mm] = (time ?? "00:00").split(":").map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0);
}

export function generateAlerts(
  input: { reservations?: Reservation[]; expenses?: Expense[]; payments?: Payment[]; days?: ItineraryDay[]; items?: ItineraryItem[] },
  opts: AlertOptions = {},
): UpcomingAlert[] {
  const now = opts.now ?? new Date();
  const lead = { ...DEFAULT_LEAD_HOURS, ...opts.leadHours };
  const overdueMs = (opts.overdueDays ?? 3) * 86_400_000;
  const out: UpcomingAlert[] = [];

  const push = (a: Omit<UpcomingAlert, "overdue">) => {
    const t = new Date(a.due_at).getTime();
    if (Number.isNaN(t)) return;
    const diff = t - now.getTime();
    if (diff > lead[a.kind] * 3_600_000) return;
    if (diff < -overdueMs) return;
    out.push({ ...a, overdue: diff < 0 });
  };

  for (const r of input.reservations ?? []) {
    if (r.status === "cancelada" || r.status === "concluida") continue;
    const label = KIND_LABEL[r.type] ?? "Reserva";
    const code = r.confirmation_code ? ` · confirmação ${r.confirmation_code}` : "";
    if (r.start_at) {
      const kind: AlertKind = r.type === "hospedagem" ? "checkin" : "inicio";
      push({
        key: `res:${r.id}:start:${r.start_at}`,
        kind,
        title: r.type === "hospedagem" ? `Check-in: ${r.title}` : `${label}: ${r.title}`,
        body: `${r.provider_name || "Fornecedor"}${code}`,
        due_at: new Date(r.start_at).toISOString(),
        ref: `reservation:${r.id}`,
        href: "/reservas",
      });
    }
    if (r.end_at && (r.type === "hospedagem" || r.type === "carro")) {
      push({
        key: `res:${r.id}:end:${r.end_at}`,
        kind: "checkout",
        title: r.type === "hospedagem" ? `Check-out: ${r.title}` : `Devolução: ${r.title}`,
        body: `${r.provider_name || "Fornecedor"}${code}`,
        due_at: new Date(r.end_at).toISOString(),
        ref: `reservation:${r.id}`,
        href: "/reservas",
      });
    }
    if (r.cancel_deadline) {
      push({
        key: `res:${r.id}:cancel:${r.cancel_deadline}`,
        kind: "cancelamento",
        title: `Prazo de cancelamento grátis: ${r.title}`,
        body: r.cancellation_policy || "Confira a política com o fornecedor.",
        due_at: new Date(r.cancel_deadline).toISOString(),
        ref: `reservation:${r.id}`,
        href: "/reservas",
      });
    }
  }

  const payments = input.payments ?? [];
  for (const e of input.expenses ?? []) {
    if (!e.due_date) continue;
    const f = itemFigures(e, payments);
    const open = f.pending > 0 ? f.pending : f.uncommitted;
    if (open <= 0 || f.status === "cancelado" || f.status === "pago") continue;
    push({
      key: `exp:${e.id}:due:${e.due_date}`,
      kind: "vencimento",
      title: `Vencimento: ${e.description}`,
      body: `Saldo em aberto: ${open.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      due_at: localDateTime(e.due_date, "09:00").toISOString(),
      ref: `expense:${e.id}`,
      href: "/orcamento",
    });
  }

  const dayById = new Map((input.days ?? []).map((d) => [d.id, d]));
  for (const it of input.items ?? []) {
    const day = dayById.get(it.day_id);
    if (!day || !it.start_time || it.booking_status === "concluido") continue;
    push({
      key: `iti:${it.id}:${day.date}T${it.start_time}`,
      kind: "horario",
      title: `${it.start_time} · ${it.title}`,
      body: it.address || day.title,
      due_at: localDateTime(day.date, it.start_time).toISOString(),
      ref: `itinerary:${it.id}`,
      href: "/roteiro",
    });
  }

  return out.sort((a, b) => a.due_at.localeCompare(b.due_at));
}

// ---------- Lidas (localStorage; simples e por dispositivo) ----------

const READ_KEY = "viajar:alerts-read";

export function readAlertKeys(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

export function markAlertsRead(keys: string[]): void {
  try {
    const set = readAlertKeys();
    keys.forEach((k) => set.add(k));
    localStorage.setItem(READ_KEY, JSON.stringify([...set].slice(-500)));
  } catch {
    /* ignore */
  }
}
