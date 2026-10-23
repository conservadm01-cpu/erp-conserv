import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { budgetCSV, budgetPDF, budgetXLSX, itemRows, summaryRows, toCSV, type ExportData } from "@/lib/budget/export";
import type { Expense, Payment } from "@/lib/types";

const T = "2026-01-01T00:00:00.000Z";
const base = { trip_id: "t", supplier: "", quantity: 1, unit_price: 0, original_currency: "BRL", fx_rate: 1, fees: 0, quoted_amount: 0, due_date: null, responsible_traveler_id: null, receipt_document_id: null, notes: "", split_mode: "todos" as const, split: {}, quote_id: null, reservation_id: null, diary_entry_id: null, incurred_on: null, created_at: T, updated_at: T };
const expenses: Expense[] = [
  { ...base, id: "e1", category_key: "hospedagem", description: 'Apto "Lago"; centro', planned_amount: 6000, reserved_amount: 5500, status: "reservado" },
  { ...base, id: "e2", category_key: "alimentacao", description: "=HYPERLINK(\"x\")", planned_amount: 1000, reserved_amount: 0, status: "previsto" },
];
const payments: Payment[] = [
  { id: "p1", trip_id: "t", expense_id: "e1", kind: "pagamento", amount: 2000, currency: "BRL", fx_rate: 1, paid_at: "2026-11-01", payer_traveler_id: null, method: "pix", notes: "", receipt_document_id: null, created_at: T, updated_at: T },
];
const data: ExportData = {
  trip: { name: "Teste", destination: "El Calafate", start_date: "2026-12-10", end_date: "2026-12-15", currency: "BRL" },
  budgetTotal: 10000,
  expenses,
  payments,
  categories: [{ key: "hospedagem", name: "Hospedagem" }],
  travelers: [],
};

describe("exportação do orçamento", () => {
  it("linhas recalculam pago, saldo e projeção", () => {
    const [r1] = itemRows(data);
    expect(r1[0]).toBe("Hospedagem");
    expect(r1[11]).toBe(2000); // pago
    expect(r1[12]).toBe(3500); // saldo a pagar
    expect(r1[14]).toBe(5500); // projeção
    const s = Object.fromEntries(summaryRows(data));
    expect(s["Total realizado (pago)"]).toBe(2000);
    expect(s["Projeção final"]).toBe(6500);
  });

  it("CSV com BOM, ';', escape de aspas e proteção contra fórmulas", () => {
    const csv = budgetCSV(data);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"Apto ""Lago""; centro"');
    expect(csv).toContain("'=HYPERLINK");
    expect(toCSV(["a"], [[1.5]])).toBe("﻿a\r\n1,5");
  });

  it("Excel com abas e valores corretos", async () => {
    const buf = await budgetXLSX(data);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Resumo", "Itens", "Categorias", "Pagamentos", "Por viajante"]);
    expect(wb.getWorksheet("Itens")!.getRow(2).getCell(12).value).toBe(2000);
  });

  it("PDF válido", async () => {
    const blob = await budgetPDF(data);
    const head = new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()).slice(0, 5));
    expect(head).toBe("%PDF-");
  });
});
