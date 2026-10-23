import type { BudgetCategory, Expense, Payment, Traveler, Trip } from "@/lib/types";
import { computeTotals, itemFigures, paymentBase, perTraveler, totalsByCategory, type Basis } from "./calc";
import { categoryName } from "./categories";

const STATUS: Record<string, string> = {
  previsto: "Previsto",
  cotado: "Cotado",
  reservado: "Reservado",
  parcial: "Pago parcial",
  pago: "Pago",
  cancelado: "Cancelado",
};

export interface ExportData {
  trip: Pick<Trip, "name" | "destination" | "start_date" | "end_date" | "currency">;
  budgetTotal: number;
  expenses: Expense[];
  payments: Payment[];
  categories: Pick<BudgetCategory, "key" | "name">[];
  travelers: Traveler[];
  basis?: Basis;
}

export const ITEM_HEADERS = [
  "Categoria", "Descrição", "Fornecedor", "Qtd.", "Valor unitário", "Moeda", "Câmbio", "Taxas",
  "Previsto", "Cotado", "Reservado", "Pago", "Saldo a pagar", "Estimativa restante", "Projeção",
  "Vencimento", "Responsável", "Status", "Observações",
];

/** Linhas do relatório de itens. Os totais são sempre recalculados a partir dos dados, nunca digitados. */
export function itemRows(d: ExportData): (string | number)[][] {
  return d.expenses.map((e) => {
    const f = itemFigures(e, d.payments);
    return [
      categoryName(e.category_key, d.categories),
      e.description,
      e.supplier,
      e.quantity,
      e.unit_price,
      e.original_currency,
      e.fx_rate,
      e.fees,
      f.planned,
      f.quoted,
      f.reserved,
      f.paid,
      f.pending,
      f.uncommitted,
      f.projected,
      e.due_date ?? "",
      d.travelers.find((t) => t.id === e.responsible_traveler_id)?.name ?? "",
      STATUS[f.status] ?? f.status,
      e.notes,
    ];
  });
}

export function summaryRows(d: ExportData): [string, number | string][] {
  const t = computeTotals(d.expenses, d.payments, d.budgetTotal);
  return [
    ["Orçamento total", t.budget],
    ["Total previsto", t.planned],
    ["Total cotado", t.quoted],
    ["Total reservado (compromissos)", t.reserved],
    ["Total realizado (pago)", t.realized],
    ["Saldo pendente", t.pending],
    ["Estimativa de itens não reservados", t.uncommitted],
    ["Projeção final", t.projected],
    ["Diferença (realizado − previsto)", t.difference],
    ["Economia (previsto − realizado)", t.economy],
    ["% do orçamento consumido", Number(t.consumedPct.toFixed(2))],
    ["Saldo disponível (orçamento − projeção)", t.availableProjected],
  ];
}

export const PAYMENT_HEADERS = ["Data", "Item", "Tipo", "Valor original", "Moeda", "Câmbio", `Valor na moeda base`, "Pagador", "Forma"];

export function paymentRows(d: ExportData): (string | number)[][] {
  return [...d.payments]
    .sort((a, b) => a.paid_at.localeCompare(b.paid_at))
    .map((p) => [
      p.paid_at,
      d.expenses.find((e) => e.id === p.expense_id)?.description ?? "(item excluído)",
      p.kind === "estorno" ? "Estorno" : "Pagamento",
      p.amount,
      p.currency,
      p.fx_rate,
      paymentBase(p),
      d.travelers.find((t) => t.id === p.payer_traveler_id)?.name ?? "",
      p.method,
    ]);
}

// ---------- CSV ----------

function csvCell(v: string | number): string {
  let s = typeof v === "number" ? v.toLocaleString("pt-BR", { useGrouping: false, maximumFractionDigits: 6 }) : String(v ?? "");
  // Neutraliza fórmulas (CSV injection) ao abrir no Excel/Sheets
  if (/^[=+\-@\t\r]/.test(s) && typeof v !== "number") s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV no padrão brasileiro do Excel: separador ";", vírgula decimal e BOM UTF-8. */
export function toCSV(headers: string[], rows: (string | number)[][]): string {
  return "﻿" + [headers, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
}

export function budgetCSV(d: ExportData): string {
  return toCSV(ITEM_HEADERS, itemRows(d));
}

// ---------- Excel ----------

export async function budgetXLSX(d: ExportData): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "VIAJAR+";
  wb.created = new Date();
  const moneyFmt = `"${d.trip.currency}" #,##0.00`;

  const resumo = wb.addWorksheet("Resumo");
  resumo.addRow([`Orçamento — ${d.trip.name}`]).font = { bold: true, size: 14 };
  resumo.addRow([`${d.trip.destination} · ${d.trip.start_date} a ${d.trip.end_date} · moeda base ${d.trip.currency}`]);
  resumo.addRow([]);
  summaryRows(d).forEach(([k, v]) => {
    const r = resumo.addRow([k, v]);
    if (typeof v === "number" && !k.startsWith("%")) r.getCell(2).numFmt = moneyFmt;
  });
  resumo.getColumn(1).width = 42;
  resumo.getColumn(2).width = 20;

  const itens = wb.addWorksheet("Itens");
  itens.addRow(ITEM_HEADERS).font = { bold: true };
  itemRows(d).forEach((r) => itens.addRow(r));
  [9, 10, 11, 12, 13, 14, 15].forEach((c) => (itens.getColumn(c).numFmt = moneyFmt));
  itens.columns.forEach((c, i) => (c.width = i === 1 ? 40 : 14));
  itens.views = [{ state: "frozen", ySplit: 1 }];

  const cats = wb.addWorksheet("Categorias");
  cats.addRow(["Categoria", "Previsto", "Realizado", "Pendente", "Projeção"]).font = { bold: true };
  totalsByCategory(d.expenses, d.payments).forEach((c) => cats.addRow([categoryName(c.category, d.categories), c.planned, c.realized, c.pending, c.projected]));
  [2, 3, 4, 5].forEach((c) => (cats.getColumn(c).numFmt = moneyFmt));
  cats.getColumn(1).width = 42;

  const pays = wb.addWorksheet("Pagamentos");
  pays.addRow(PAYMENT_HEADERS).font = { bold: true };
  paymentRows(d).forEach((r) => pays.addRow(r));
  pays.getColumn(7).numFmt = moneyFmt;

  const pessoas = wb.addWorksheet("Por viajante");
  pessoas.addRow(["Viajante", "Parte no custo", "Pagou", "Saldo (+ recebe / − deve)"]).font = { bold: true };
  perTraveler(d.expenses, d.payments, d.travelers, d.basis ?? "projecao").forEach((s) => pessoas.addRow([s.name, s.share, s.paid, s.balance]));
  [2, 3, 4].forEach((c) => (pessoas.getColumn(c).numFmt = moneyFmt));
  pessoas.getColumn(1).width = 24;

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

// ---------- PDF ----------

export async function budgetPDF(d: ExportData): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: d.trip.currency });
  doc.setFontSize(16);
  doc.text(`Orçamento — ${d.trip.name}`, 14, 16);
  doc.setFontSize(10);
  doc.text(`${d.trip.destination} · ${d.trip.start_date} a ${d.trip.end_date} · gerado em ${new Date().toLocaleString("pt-BR")}`, 14, 22);
  autoTable(doc, {
    startY: 28,
    head: [["Resumo", "Valor"]],
    body: summaryRows(d).map(([k, v]) => [k, typeof v === "number" && !k.startsWith("%") ? fmt(v) : `${v}%`]),
    theme: "grid",
    styles: { fontSize: 9 },
    tableWidth: 140,
  });
  autoTable(doc, {
    head: [["Categoria", "Descrição", "Previsto", "Cotado", "Reservado", "Pago", "Saldo", "Projeção", "Vencimento", "Status"]],
    body: itemRows(d).map((r) => [r[0], r[1], fmt(r[8] as number), fmt(r[9] as number), fmt(r[10] as number), fmt(r[11] as number), fmt(r[12] as number), fmt(r[14] as number), r[15], r[17]]),
    styles: { fontSize: 8, overflow: "linebreak" },
    headStyles: { fillColor: [31, 117, 150] },
    rowPageBreak: "avoid",
    showHead: "everyPage",
  });
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`VIAJAR+ · página ${i} de ${pages}`, doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 6, { align: "right" });
  }
  return doc.output("blob");
}

export function downloadBlob(data: Blob | ArrayBuffer | string, filename: string, mime: string): void {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
