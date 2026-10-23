"use client";
import { useMemo, useState } from "react";
import { CalendarCheck, Pencil, Plus, Ticket, Trash2, Link2, AlertTriangle } from "lucide-react";
import { RequireTrip } from "@/components/layout/require-trip";
import { PageHeader, Loading, Notice, EmptyState } from "@/components/ui/states";
import { Button, ExternalLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { ReservationForm, STATUS_LABEL, TYPE_LABEL, type ReservationSubmit } from "@/components/reservations/reservation-form";
import { DocumentList, DocumentUploader } from "@/components/reservations/documents";
import { UpcomingAlerts } from "@/components/notifications/upcoming-alerts";
import { getRepo } from "@/lib/data";
import { useRows } from "@/lib/data/hooks";
import { itemFigures } from "@/lib/budget/calc";
import { syncItineraryForReservation, syncReservationExpense, unlinkReservationExpense } from "@/lib/reservations/budget-link";
import { fmtDate, fmtDateTime, money } from "@/lib/format";
import type { Expense, ItineraryItem, Payment, Reservation, Trip, TripDocument } from "@/lib/types";

export default function ReservasPage() {
  return <RequireTrip>{(trip) => <Reservas trip={trip} />}</RequireTrip>;
}

const STATUS_TONE: Record<Reservation["status"], "amber" | "green" | "red" | "violet"> = { pendente: "amber", confirmada: "green", cancelada: "red", concluida: "violet" };

function Reservas({ trip }: { trip: Trip }) {
  const toast = useToast();
  const reservations = useRows("reservations", { trip_id: trip.id });
  const documents = useRows("documents", { trip_id: trip.id });
  const expenses = useRows("expenses", { trip_id: trip.id });
  const payments = useRows("payments", { trip_id: trip.id });
  const items = useRows("itinerary_items", { trip_id: trip.id });
  const [editing, setEditing] = useState<{ r: Reservation | null } | null>(null);
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");

  const list = useMemo(
    () =>
      reservations.data
        .filter((r) => (!status || r.status === status) && (!type || r.type === type))
        .sort((a, b) => (a.start_at ?? "9999").localeCompare(b.start_at ?? "9999")),
    [reservations.data, status, type],
  );
  const tripDocs = documents.data.filter((d) => !d.reservation_id);
  const active = reservations.data.filter((r) => r.status !== "cancelada");
  const confirmed = active.filter((r) => r.status === "confirmada").length;

  async function save(s: ReservationSubmit) {
    const repo = getRepo();
    try {
      let r: Reservation;
      if (editing?.r) r = await repo.update("reservations", editing.r.id, s.values);
      else r = await repo.insert("reservations", { ...s.values, trip_id: trip.id, expense_id: null });
      if (s.linkBudget) {
        const { created } = await syncReservationExpense(trip, r, s.fxRate);
        toast(created ? "Reserva salva e lançada no orçamento como valor reservado" : "Reserva salva; orçamento atualizado");
      } else {
        if (r.expense_id) await unlinkReservationExpense(r);
        toast("Reserva salva");
      }
      const reverted = await syncItineraryForReservation(r);
      if (reverted) toast(`${reverted} item(ns) do roteiro voltaram a "planejado" porque a reserva não está confirmada`, "info");
      setEditing(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao salvar reserva", "error");
    }
  }

  async function remove(r: Reservation) {
    const docs = documents.data.filter((d) => d.reservation_id === r.id);
    if (!confirm(`Excluir a reserva "${r.title}"?${r.expense_id ? "\nA despesa no orçamento e seus pagamentos serão mantidos, sem o valor reservado." : ""}${docs.length ? `\n${docs.length} documento(s) anexado(s) continuarão em Documentos da viagem.` : ""}`)) return;
    try {
      const repo = getRepo();
      if (r.expense_id) await unlinkReservationExpense(r);
      for (const it of items.data.filter((i) => i.reservation_id === r.id)) {
        await repo.update("itinerary_items", it.id, { reservation_id: null, booking_status: it.booking_status === "reservado" ? "planejado" : it.booking_status });
      }
      for (const d of docs) await repo.update("documents", d.id, { reservation_id: null });
      await repo.remove("reservations", r.id);
      toast("Reserva excluída");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao excluir", "error");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={trip.destination}
        title="Reservas e documentos"
        description="Centralize confirmações, políticas de cancelamento, vouchers e comprovantes. Reservar não é pagar: os pagamentos são registrados no Orçamento."
        actions={
          <Button onClick={() => setEditing({ r: null })}>
            <Plus className="h-4 w-4" aria-hidden /> Nova reserva
          </Button>
        }
      />
      {reservations.error && <Notice tone="error" className="mb-4">{reservations.error}</Notice>}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Reservas ativas" value={active.length} />
        <Stat label="Confirmadas" value={confirmed} tone={confirmed ? "good" : "default"} />
        <Stat label="Pendentes" value={active.filter((r) => r.status === "pendente").length} tone="warn" />
        <Stat label="Documentos" value={documents.data.length} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="f-status">Filtrar por status</label>
            <Select id="f-status" className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos os status</option>
              {Object.entries(STATUS_LABEL).map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </Select>
            <label className="sr-only" htmlFor="f-type">Filtrar por tipo</label>
            <Select id="f-type" className="w-auto" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Todos os tipos</option>
              {Object.entries(TYPE_LABEL).map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </Select>
          </div>

          {reservations.loading && !reservations.data.length ? (
            <Loading rows={3} />
          ) : !list.length ? (
            <EmptyState icon={<Ticket />} title={reservations.data.length ? "Nenhuma reserva com esses filtros" : "Nenhuma reserva cadastrada"} action={<Button onClick={() => setEditing({ r: null })}>Cadastrar reserva</Button>}>
              Cadastre aqui somente reservas feitas e confirmadas pelo fornecedor (ou pendentes de confirmação). O VIAJAR+ não conclui compras.
            </EmptyState>
          ) : (
            list.map((r) => (
              <ReservationCard
                key={r.id}
                r={r}
                trip={trip}
                docs={documents.data.filter((d) => d.reservation_id === r.id)}
                expense={expenses.data.find((e) => e.id === r.expense_id) ?? null}
                payments={payments.data}
                items={items.data}
                onEdit={() => setEditing({ r })}
                onDelete={() => void remove(r)}
              />
            ))
          )}
        </div>

        <div className="space-y-6">
          <UpcomingAlerts tripId={trip.id} limit={8} />
          <Card>
            <CardHeader title="Documentos da viagem" subtitle="Seguro, passaportes, autorizações de viagem de menor e outros" />
            <CardBody className="space-y-3">
              <DocumentUploader tripId={trip.id} defaultKind="seguro" />
              <DocumentList docs={tripDocs} />
              <p className="text-xs text-muted">Arquivos ficam em armazenamento privado e abrem por link temporário.</p>
            </CardBody>
          </Card>
        </div>
      </div>

      <Modal open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={editing?.r ? "Editar reserva" : "Nova reserva"} size="lg">
        {editing && <ReservationForm trip={trip} initial={editing.r} onSubmit={save} onCancel={() => setEditing(null)} />}
      </Modal>
    </>
  );
}

function ReservationCard({
  r, trip, docs, expense, payments, items, onEdit, onDelete,
}: {
  r: Reservation;
  trip: Trip;
  docs: TripDocument[];
  expense: Expense | null;
  payments: Payment[];
  items: ItineraryItem[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const toast = useToast();
  const fig = expense ? itemFigures(expense, payments) : null;
  const deadlineSoon = r.cancel_deadline && r.status !== "cancelada" && new Date(r.cancel_deadline).getTime() - Date.now() < 7 * 86_400_000 && new Date(r.cancel_deadline).getTime() > Date.now();
  const linked = items.filter((i) => i.reservation_id === r.id);
  const linkable = items.filter((i) => !i.reservation_id && (i.kind === "passeio" || i.kind === "outro" || i.kind === "refeicao"));

  async function linkItem(id: string) {
    try {
      await getRepo().update("itinerary_items", id, { reservation_id: r.id, booking_status: r.status === "confirmada" ? "reservado" : "planejado" });
      toast(r.status === "confirmada" ? "Item do roteiro marcado como reservado" : "Item vinculado; ficará como reservado quando a reserva for confirmada");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao vincular", "error");
    }
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {r.title}
            <Badge tone="blue">{TYPE_LABEL[r.type]}</Badge>
            <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
          </span>
        }
        subtitle={[r.provider_name, r.confirmation_code ? `Confirmação ${r.confirmation_code}` : null].filter(Boolean).join(" · ") || undefined}
        action={
          <>
            <Button size="icon" variant="ghost" onClick={onEdit} aria-label={`Editar ${r.title}`}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onDelete} aria-label={`Excluir ${r.title}`}>
              <Trash2 className="h-4 w-4 text-red-600" />
            </Button>
          </>
        }
      />
      <CardBody className="space-y-4 text-sm">
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted">{r.type === "hospedagem" ? "Check-in" : "Início"}</dt>
            <dd>{fmtDateTime(r.start_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{r.type === "hospedagem" ? "Check-out" : "Fim"}</dt>
            <dd>{fmtDateTime(r.end_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Valor</dt>
            <dd className="font-semibold tabular-nums">{money(r.amount, r.currency)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Cancelamento sem custo até</dt>
            <dd className={deadlineSoon ? "font-semibold text-amber-700 dark:text-amber-300" : undefined}>
              {deadlineSoon && <AlertTriangle className="mr-1 inline h-3.5 w-3.5" aria-hidden />}
              {fmtDateTime(r.cancel_deadline)}
            </dd>
          </div>
          {r.cancellation_policy && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted">Política de cancelamento</dt>
              <dd className="whitespace-pre-line">{r.cancellation_policy}</dd>
            </div>
          )}
          {r.notes && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted">Observações</dt>
              <dd className="whitespace-pre-line">{r.notes}</dd>
            </div>
          )}
        </dl>
        {r.url && (
          <p>
            <ExternalLink href={r.url}>Abrir reserva no site do fornecedor</ExternalLink>
          </p>
        )}

        <div className="rounded-xl bg-surface-2/60 p-3">
          <div className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
            <CalendarCheck className="h-3.5 w-3.5" aria-hidden /> Orçamento
          </div>
          {fig && expense ? (
            <p>
              Reservado {money(fig.reserved, trip.currency)} · Pago {money(fig.paid, trip.currency)} · Saldo a pagar{" "}
              <strong>{money(fig.pending, trip.currency)}</strong>
              {expense.due_date && <> · vence {fmtDate(expense.due_date)}</>}{" "}
              <a className="text-accent underline" href="/orcamento">registrar pagamento</a>
            </p>
          ) : (
            <p className="text-muted">Não vinculada ao orçamento. Edite a reserva para lançá-la como valor reservado.</p>
          )}
        </div>

        {(r.type === "passeio" || linked.length > 0) && (
          <div>
            <div className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
              <Link2 className="h-3.5 w-3.5" aria-hidden /> Roteiro
            </div>
            {linked.length > 0 && <p className="mb-1">Vinculado a: {linked.map((i) => i.title).join(", ")}</p>}
            {linkable.length > 0 && (
              <>
                <label className="sr-only" htmlFor={`link-${r.id}`}>Vincular a item do roteiro</label>
                <Select id={`link-${r.id}`} className="h-8 w-auto text-xs" value="" onChange={(e) => e.target.value && void linkItem(e.target.value)}>
                  <option value="">Vincular a item do roteiro…</option>
                  {linkable.map((i) => (
                    <option key={i.id} value={i.id}>{i.title}</option>
                  ))}
                </Select>
              </>
            )}
            {r.status !== "confirmada" && <p className="mt-1 text-xs text-muted">Itens vinculados só aparecem como reservados após a confirmação.</p>}
          </div>
        )}

        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Vouchers e comprovantes</div>
          <DocumentList docs={docs} />
          <DocumentUploader tripId={trip.id} reservationId={r.id} defaultKind={r.type === "voo" ? "bilhete" : "voucher"} />
        </div>
      </CardBody>
    </Card>
  );
}
