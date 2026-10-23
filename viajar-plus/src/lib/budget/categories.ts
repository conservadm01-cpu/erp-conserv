import type { BudgetCategory, ID, NewRow } from "@/lib/types";

export interface CategoryDef {
  key: string;
  name: string;
  color: string;
}

export const DEFAULT_CATEGORIES: CategoryDef[] = [
  { key: "passagens", name: "Passagens", color: "#2563eb" },
  { key: "bagagem_aeroporto", name: "Bagagem e transporte até o aeroporto", color: "#0891b2" },
  { key: "hospedagem", name: "Hospedagem", color: "#7c3aed" },
  { key: "carro", name: "Carro, combustível, estacionamento e pedágios", color: "#ea580c" },
  { key: "transporte", name: "Transporte público e transfer", color: "#0d9488" },
  { key: "passeios", name: "Passeios, ingressos e guias", color: "#16a34a" },
  { key: "alimentacao", name: "Alimentação", color: "#dc2626" },
  { key: "seguro", name: "Seguro viagem", color: "#4f46e5" },
  { key: "documentacao", name: "Documentação e taxas", color: "#64748b" },
  { key: "compras", name: "Compras", color: "#db2777" },
  { key: "internet", name: "Internet e telefonia", color: "#0284c7" },
  { key: "emergencias", name: "Emergências e imprevistos", color: "#b91c1c" },
  { key: "outros", name: "Outras despesas", color: "#a16207" },
];

export function defaultCategoryRows(tripId: ID): NewRow<"budget_categories">[] {
  return DEFAULT_CATEGORIES.map((c, i) => ({ trip_id: tripId, key: c.key, name: c.name, color: c.color, is_custom: false, position: i }));
}

export function categoryName(key: string, cats: Pick<BudgetCategory, "key" | "name">[]): string {
  return cats.find((c) => c.key === key)?.name ?? DEFAULT_CATEGORIES.find((c) => c.key === key)?.name ?? key;
}

export function categoryColor(key: string, cats: Pick<BudgetCategory, "key" | "color">[]): string {
  return cats.find((c) => c.key === key)?.color ?? DEFAULT_CATEGORIES.find((c) => c.key === key)?.color ?? "#94a3b8";
}

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}
