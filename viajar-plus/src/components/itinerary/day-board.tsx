"use client";
import { useEffect, useMemo, useState } from "react";
import {
  DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCorners, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent, DragOverlay,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, Clock, GripVertical, MapPin, Pencil, Plus, Trash2, Wand2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtDate, minutesLabel, money } from "@/lib/format";
import { dayLoadMin, formatTime, parseTime, type ItineraryIssue } from "@/lib/itinerary/conflicts";
import { cn } from "@/lib/cn";
import type { ID, ItineraryDay, ItineraryItem } from "@/lib/types";
import { BOOKING_LABEL, KIND_LABEL } from "./item-form";

export type Groups = Record<ID, ItineraryItem[]>;

export function groupItems(days: ItineraryDay[], items: ItineraryItem[]): Groups {
  const g: Groups = {};
  days.forEach((d) => (g[d.id] = []));
  items.forEach((i) => g[i.day_id]?.push(i));
  Object.values(g).forEach((l) => l.sort((a, b) => a.position - b.position));
  return g;
}

const DAY_PREFIX = "day:";

function findContainer(groups: Groups, id: string): ID | null {
  if (id.startsWith(DAY_PREFIX)) return id.slice(DAY_PREFIX.length);
  return Object.keys(groups).find((d) => groups[d].some((i) => i.id === id)) ?? null;
}

export function DayBoard({
  days,
  items,
  issues,
  readOnly,
  onPersist,
  onEdit,
  onDelete,
  onAdd,
  onFitTimes,
}: {
  days: ItineraryDay[];
  items: ItineraryItem[];
  issues: ItineraryIssue[];
  readOnly?: boolean;
  onPersist: (groups: Groups) => Promise<void>;
  onEdit: (item: ItineraryItem) => void;
  onDelete: (item: ItineraryItem) => void;
  onAdd: (dayId: ID) => void;
  onFitTimes: (dayId: ID) => void;
}) {
  const [groups, setGroups] = useState<Groups>(() => groupItems(days, items));
  const [activeId, setActiveId] = useState<string | null>(null);
  useEffect(() => {
    if (!activeId) setGroups(groupItems(days, items));
  }, [days, items, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const issuesByItem = useMemo(() => {
    const m = new Map<string, ItineraryIssue[]>();
    issues.filter((i) => i.kind !== "dia_cheio").forEach((i) => i.item_ids.forEach((id) => m.set(id, [...(m.get(id) ?? []), i])));
    return m;
  }, [issues]);

  function commit(next: Groups) {
    setGroups(next);
    void onPersist(next);
  }

  function move(item: ItineraryItem, toDay: ID, toIndex?: number) {
    const from = findContainer(groups, item.id);
    if (!from) return;
    const next: Groups = { ...groups, [from]: groups[from].filter((i) => i.id !== item.id) };
    const target = [...(next[toDay] ?? [])];
    target.splice(toIndex ?? target.length, 0, item);
    next[toDay] = target;
    commit(next);
  }

  function shift(item: ItineraryItem, delta: number) {
    const day = findContainer(groups, item.id);
    if (!day) return;
    const list = groups[day];
    const idx = list.findIndex((i) => i.id === item.id);
    const to = idx + delta;
    if (to < 0 || to >= list.length) return;
    commit({ ...groups, [day]: arrayMove(list, idx, to) });
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    const active = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    setActiveId(null);
    if (!over) return;
    const from = findContainer(groups, active);
    const to = findContainer(groups, over);
    if (!from || !to) return;
    if (from === to) {
      const list = groups[from];
      const oldIndex = list.findIndex((i) => i.id === active);
      const newIndex = over.startsWith(DAY_PREFIX) ? list.length - 1 : list.findIndex((i) => i.id === over);
      if (oldIndex !== newIndex && newIndex >= 0) commit({ ...groups, [from]: arrayMove(list, oldIndex, newIndex) });
      return;
    }
    const item = groups[from].find((i) => i.id === active);
    if (!item) return;
    const idx = over.startsWith(DAY_PREFIX) ? undefined : groups[to].findIndex((i) => i.id === over);
    move(item, to, idx != null && idx >= 0 ? idx : undefined);
  }

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
      accessibility={{
        screenReaderInstructions: { draggable: "Para mover, pressione espaço, use as setas e pressione espaço novamente para soltar. Esc cancela." },
        announcements: {
          onDragStart: ({ active }) => `Movendo ${items.find((i) => i.id === active.id)?.title ?? "item"}.`,
          onDragOver: ({ over }) => (over ? "Sobre uma nova posição." : "Fora de uma área válida."),
          onDragEnd: ({ over }) => (over ? "Item reposicionado." : "Movimento cancelado."),
          onDragCancel: () => "Movimento cancelado.",
        },
      }}
    >
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {days.map((d) => (
          <DayColumn
            key={d.id}
            day={d}
            days={days}
            items={groups[d.id] ?? []}
            dayIssues={issues.filter((i) => i.day_id === d.id && i.kind === "dia_cheio")}
            issuesByItem={issuesByItem}
            readOnly={readOnly}
            onAdd={() => onAdd(d.id)}
            onFitTimes={() => onFitTimes(d.id)}
            onEdit={onEdit}
            onDelete={onDelete}
            onShift={shift}
            onMoveDay={(item, to) => move(item, to)}
          />
        ))}
      </div>
      <DragOverlay>{activeItem ? <div className="rounded-xl border border-accent bg-surface p-3 text-sm shadow-2xl">{activeItem.title}</div> : null}</DragOverlay>
    </DndContext>
  );
}

function DayColumn({
  day, days, items, dayIssues, issuesByItem, readOnly, onAdd, onFitTimes, onEdit, onDelete, onShift, onMoveDay,
}: {
  day: ItineraryDay;
  days: ItineraryDay[];
  items: ItineraryItem[];
  dayIssues: ItineraryIssue[];
  issuesByItem: Map<string, ItineraryIssue[]>;
  readOnly?: boolean;
  onAdd: () => void;
  onFitTimes: () => void;
  onEdit: (i: ItineraryItem) => void;
  onDelete: (i: ItineraryItem) => void;
  onShift: (i: ItineraryItem, delta: number) => void;
  onMoveDay: (i: ItineraryItem, to: ID) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${DAY_PREFIX}${day.id}` });
  const load = dayLoadMin(items);
  const cost = items.reduce<Record<string, number>>((acc, i) => {
    if (i.cost_estimate) acc[i.currency] = (acc[i.currency] ?? 0) + i.cost_estimate;
    return acc;
  }, {});
  return (
    <section aria-labelledby={`day-${day.id}`} className={cn("flex flex-col rounded-2xl border bg-surface", isOver ? "border-accent ring-2 ring-accent/30" : "border-line")}>
      <header className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-sunset-600 dark:text-sunset-400">
            {fmtDate(day.date, { weekday: "long", day: "2-digit", month: "long" })}
          </div>
          <h2 id={`day-${day.id}`} className="font-display text-lg font-semibold">{day.title}</h2>
          <div className="mt-0.5 text-xs text-muted">
            {items.length} {items.length === 1 ? "item" : "itens"} · {minutesLabel(load)} planejadas
            {Object.entries(cost).map(([c, v]) => ` · ${money(v, c)}`)}
          </div>
        </div>
        {!readOnly && (
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={onFitTimes} title="Encaixar horários em sequência" aria-label={`Encaixar horários de ${day.title}`}>
              <Wand2 className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onAdd} aria-label={`Adicionar item em ${day.title}`}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </header>
      {dayIssues.map((i) => (
        <div key={i.message} className="mx-3 mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-100">
          <strong>{i.message}</strong>
          {i.suggestion && <div>Sugestão: {i.suggestion}</div>}
        </div>
      ))}
      <SortableContext id={day.id} items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ol ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2 p-3">
          {items.length === 0 && (
            <li className="grid flex-1 place-items-center rounded-xl border border-dashed border-line p-4 text-center text-sm text-muted">
              Dia livre. Arraste um item para cá ou adicione uma atividade.
            </li>
          )}
          {items.map((it, idx) => (
            <SortableItem
              key={it.id}
              item={it}
              days={days}
              first={idx === 0}
              last={idx === items.length - 1}
              issues={issuesByItem.get(it.id) ?? []}
              readOnly={readOnly}
              onEdit={() => onEdit(it)}
              onDelete={() => onDelete(it)}
              onUp={() => onShift(it, -1)}
              onDown={() => onShift(it, 1)}
              onMoveDay={(to) => onMoveDay(it, to)}
            />
          ))}
        </ol>
      </SortableContext>
    </section>
  );
}

const STATUS_TONE: Record<ItineraryItem["booking_status"], "neutral" | "blue" | "green" | "violet"> = {
  sugestao: "neutral",
  planejado: "blue",
  reservado: "green",
  concluido: "violet",
};

function SortableItem({
  item, days, first, last, issues, readOnly, onEdit, onDelete, onUp, onDown, onMoveDay,
}: {
  item: ItineraryItem;
  days: ItineraryDay[];
  first: boolean;
  last: boolean;
  issues: ItineraryIssue[];
  readOnly?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onUp: () => void;
  onDown: () => void;
  onMoveDay: (to: ID) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: readOnly });
  const start = parseTime(item.start_time);
  const hasError = issues.some((i) => i.severity === "erro");
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-xl border bg-bg/60 p-3 text-sm",
        isDragging && "opacity-40",
        hasError ? "border-red-400" : issues.length ? "border-amber-400" : "border-line",
      )}
    >
      <div className="flex items-start gap-2">
        {!readOnly && (
          <button {...attributes} {...listeners} className="mt-0.5 cursor-grab touch-none rounded p-1 text-muted hover:bg-surface-2 active:cursor-grabbing" aria-label={`Arrastar ${item.title}`}>
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {start != null && (
              <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {formatTime(start)}–{formatTime(start + item.duration_min)}
              </span>
            )}
            <span className="font-medium">{item.title}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge>{KIND_LABEL[item.kind]}</Badge>
            <Badge tone={STATUS_TONE[item.booking_status]}>{BOOKING_LABEL[item.booking_status]}</Badge>
            {start == null && <Badge>{minutesLabel(item.duration_min)}</Badge>}
            {item.cost_estimate > 0 && <Badge tone="amber">≈ {money(item.cost_estimate, item.currency)}</Badge>}
            {item.travel_min_from_prev != null && <Badge>🚗 {minutesLabel(item.travel_min_from_prev)}</Badge>}
            {item.opening_hours && <Badge>Abre {item.opening_hours}</Badge>}
          </div>
          {item.address && (
            <div className="mt-1 flex items-center gap-1 text-xs text-muted">
              <MapPin className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">{item.address}</span>
            </div>
          )}
          {item.notes && <p className="mt-1 text-xs text-muted">{item.notes}</p>}
          {issues.map((i) => (
            <p key={i.message} className={cn("mt-1 flex gap-1 text-xs", i.severity === "erro" ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-300")}>
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              <span>
                {i.message}
                {i.suggestion ? ` ${i.suggestion}` : ""}
              </span>
            </p>
          ))}
        </div>
      </div>
      {!readOnly && (
        <div className="mt-2 flex flex-wrap items-center justify-end gap-1">
          <Button size="icon" variant="ghost" onClick={onUp} disabled={first} aria-label={`Mover ${item.title} para cima`}>
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onDown} disabled={last} aria-label={`Mover ${item.title} para baixo`}>
            <ArrowDown className="h-4 w-4" />
          </Button>
          <label className="sr-only" htmlFor={`mv-${item.id}`}>Mover para outro dia</label>
          <select
            id={`mv-${item.id}`}
            className="h-8 rounded-lg border border-line bg-surface px-1 text-xs"
            value={item.day_id}
            onChange={(e) => onMoveDay(e.target.value)}
          >
            {days.map((d) => (
              <option key={d.id} value={d.id}>
                {fmtDate(d.date, { day: "2-digit", month: "short" })}
              </option>
            ))}
          </select>
          <Button size="icon" variant="ghost" onClick={onEdit} aria-label={`Editar ${item.title}`}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onDelete} aria-label={`Excluir ${item.title}`}>
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      )}
    </li>
  );
}
