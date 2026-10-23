"use client";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CategoryTotals, TravelerShare } from "@/lib/budget/calc";
import { categoryName } from "@/lib/budget/categories";
import { fmtDate } from "@/lib/format";
import type { BudgetCategory } from "@/lib/types";

// Gráficos do orçamento. Cores por função: série 1 = previsto, série 2 = realizado;
// gráficos de série única usam a cor de destaque. Texto sempre nas cores de texto.

const axis = { stroke: "var(--muted)", fontSize: 12, tickLine: false, axisLine: false } as const;
const tooltipStyle = { contentStyle: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--fg)", fontSize: 13 }, labelStyle: { color: "var(--fg)", fontWeight: 600 } };

type Fmt = (v: number) => string;

function short(v: number): string {
  return Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : v.toLocaleString("pt-BR");
}

export function PlannedVsRealized({ data, categories, fmt }: { data: CategoryTotals[]; categories: BudgetCategory[]; fmt: Fmt }) {
  const rows = data
    .filter((d) => d.planned || d.realized)
    .map((d) => ({ name: categoryName(d.category, categories), Previsto: d.planned, Realizado: d.realized }))
    .sort((a, b) => b.Previsto - a.Previsto);
  if (!rows.length) return <p className="text-sm text-muted">Sem valores para comparar ainda.</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 52)}>
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }} barGap={2}>
        <CartesianGrid horizontal={false} stroke="var(--grid)" />
        <XAxis type="number" {...axis} tickFormatter={short} />
        <YAxis type="category" dataKey="name" {...axis} width={150} tickFormatter={(s: string) => (s.length > 22 ? `${s.slice(0, 21)}…` : s)} />
        <Tooltip {...tooltipStyle} formatter={(v) => fmt(Number(v))} cursor={{ fill: "var(--surface-2)" }} />
        <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} />
        <Bar dataKey="Previsto" fill="var(--series-1)" radius={[0, 4, 4, 0]} barSize={12} />
        <Bar dataKey="Realizado" fill="var(--series-2)" radius={[0, 4, 4, 0]} barSize={12} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ByCategory({ data, categories, fmt }: { data: CategoryTotals[]; categories: BudgetCategory[]; fmt: Fmt }) {
  const rows = data
    .filter((d) => d.projected > 0)
    .map((d) => ({ name: categoryName(d.category, categories), Projeção: d.projected }))
    .sort((a, b) => b.Projeção - a.Projeção);
  if (!rows.length) return <p className="text-sm text-muted">Adicione itens ao orçamento para ver a distribuição.</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, rows.length * 34)}>
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid horizontal={false} stroke="var(--grid)" />
        <XAxis type="number" {...axis} tickFormatter={short} />
        <YAxis type="category" dataKey="name" {...axis} width={150} tickFormatter={(s: string) => (s.length > 22 ? `${s.slice(0, 21)}…` : s)} />
        <Tooltip {...tooltipStyle} formatter={(v) => fmt(Number(v))} cursor={{ fill: "var(--surface-2)" }} />
        <Bar dataKey="Projeção" fill="var(--series-1)" radius={[0, 4, 4, 0]} barSize={14} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Evolution({ data, budget, fmt }: { data: { date: string; cumulative: number }[]; budget: number; fmt: Fmt }) {
  if (!data.length) return <p className="text-sm text-muted">Nenhum pagamento registrado ainda. A evolução aparece conforme você registra pagamentos.</p>;
  const rows = data.map((d) => ({ ...d, label: fmtDate(d.date, { day: "2-digit", month: "short" }) }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={rows} margin={{ left: 8, right: 16, top: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis dataKey="label" {...axis} />
        <YAxis {...axis} tickFormatter={short} width={60} domain={[0, (max: number) => Math.max(max, budget)]} />
        <Tooltip {...tooltipStyle} formatter={(v) => [fmt(Number(v)), "Realizado acumulado"]} />
        <Line type="monotone" dataKey="cumulative" name="Realizado acumulado" stroke="var(--series-1)" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: "var(--surface)" }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function PerPerson({ data, fmt }: { data: TravelerShare[]; fmt: Fmt }) {
  if (!data.length) return <p className="text-sm text-muted">Cadastre os viajantes para ver o custo por pessoa.</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 40)}>
      <BarChart data={data.map((d) => ({ name: d.name, Parte: d.share }))} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid horizontal={false} stroke="var(--grid)" />
        <XAxis type="number" {...axis} tickFormatter={short} />
        <YAxis type="category" dataKey="name" {...axis} width={90} />
        <Tooltip {...tooltipStyle} formatter={(v) => fmt(Number(v))} cursor={{ fill: "var(--surface-2)" }} />
        <Bar dataKey="Parte" name="Parte no custo" fill="var(--series-1)" radius={[0, 4, 4, 0]} barSize={14} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Saldo disponível: barra de progresso com realizado, compromissos e estimativas sobre o orçamento. */
export function BudgetMeter({ realized, pending, uncommitted, budget, fmt }: { realized: number; pending: number; uncommitted: number; budget: number; fmt: Fmt }) {
  const total = Math.max(budget, realized + pending + uncommitted, 1);
  const w = (v: number) => `${Math.max(0, (v / total) * 100)}%`;
  const over = realized + pending + uncommitted > budget && budget > 0;
  return (
    <div>
      <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`Realizado ${fmt(realized)}, a pagar ${fmt(pending)}, estimado ${fmt(uncommitted)}, orçamento ${fmt(budget)}`}>
        <div className="rounded-l-full" style={{ width: w(realized), background: "var(--series-1)" }} />
        <div style={{ width: w(pending), background: "var(--series-2)" }} />
        <div className="rounded-r-full" style={{ width: w(uncommitted), background: "repeating-linear-gradient(45deg, var(--series-3) 0 4px, transparent 4px 8px)" }} />
      </div>
      {budget > 0 && <div className="relative h-0"><div className="absolute -top-5 h-6 w-0.5 bg-fg" style={{ left: `calc(${(budget / total) * 100}% - 1px)` }} title="Limite do orçamento" /></div>}
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--series-1)" }} />Pago {fmt(realized)}</li>
        <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--series-2)" }} />Compromissos a pagar {fmt(pending)}</li>
        <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "repeating-linear-gradient(45deg, var(--series-3) 0 2px, transparent 2px 4px)" }} />Estimativas não reservadas {fmt(uncommitted)}</li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-0.5 bg-fg" />Orçamento {fmt(budget)}</li>
      </ul>
      {over && <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">⚠ A projeção ultrapassa o orçamento em {fmt(realized + pending + uncommitted - budget)}.</p>}
    </div>
  );
}
