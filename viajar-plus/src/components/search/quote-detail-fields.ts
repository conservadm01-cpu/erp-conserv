import type { QuoteType } from "@/lib/types";

export interface DetailField {
  key: string;
  label: string;
  kind?: "text" | "number" | "select";
  options?: string[];
}

/** Campos extras registrados em quote.details, por tipo de cotação. */
export const DETAIL_FIELDS: Record<QuoteType, DetailField[]> = {
  voo: [
    { key: "companhia", label: "Companhia" },
    { key: "rota", label: "Aeroportos (ex.: GRU → AEP → FTE)" },
    { key: "horarios", label: "Horários" },
    { key: "escalas", label: "Escalas", kind: "number" },
    { key: "bagagem", label: "Bagagem incluída" },
    { key: "regras", label: "Regras tarifárias" },
  ],
  hospedagem: [
    { key: "tipo", label: "Tipo", kind: "select", options: ["hotel", "apartamento", "casa", "pousada", "outro"] },
    { key: "quartos_camas", label: "Quartos / camas" },
    { key: "taxas", label: "Taxas e impostos (informados?)" },
    { key: "cafe_da_manha", label: "Café da manhã", kind: "select", options: ["", "sim", "não"] },
    { key: "cozinha", label: "Cozinha", kind: "select", options: ["", "sim", "não"] },
    { key: "estacionamento", label: "Estacionamento", kind: "select", options: ["", "sim", "não"] },
    { key: "cancelamento", label: "Política de cancelamento" },
    { key: "avaliacao_vista", label: "Avaliação vista no site (nota e fonte)" },
    { key: "distancia_centro", label: "Distância do centro/atrações" },
  ],
  carro: [
    { key: "locadora", label: "Locadora" },
    { key: "retirada", label: "Local/horário de retirada" },
    { key: "devolucao", label: "Local/horário de devolução" },
    { key: "categoria", label: "Categoria" },
    { key: "cambio", label: "Câmbio", kind: "select", options: ["", "manual", "automático"] },
    { key: "passageiros", label: "Capacidade real de passageiros", kind: "number" },
    { key: "malas", label: "Capacidade real de malas", kind: "number" },
    { key: "taxas", label: "Taxas informadas" },
    { key: "caucao", label: "Caução", kind: "number" },
    { key: "seguro", label: "Cobertura de seguro" },
    { key: "franquia", label: "Franquia" },
    { key: "combustivel", label: "Política de combustível" },
    { key: "quilometragem", label: "Quilometragem" },
    { key: "cancelamento", label: "Política de cancelamento" },
    { key: "motorista_adicional", label: "Motorista adicional" },
    { key: "habilitacao", label: "Requisitos de habilitação (ex.: PID, idade mínima)" },
  ],
  passeio: [
    { key: "preco_pessoa", label: "Preço por pessoa", kind: "number" },
    { key: "preco_grupo", label: "Preço por grupo", kind: "number" },
    { key: "duracao", label: "Duração" },
    { key: "idade_minima", label: "Idade mínima", kind: "number" },
    { key: "acessibilidade", label: "Acessibilidade" },
    { key: "saida", label: "Local de saída" },
    { key: "cancelamento", label: "Política de cancelamento" },
  ],
  outro: [],
};
