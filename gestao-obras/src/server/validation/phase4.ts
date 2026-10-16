import { z } from "zod";
import { optionalText, requiredText, uuid } from "./common";
import { optionalDate } from "./phase3";

const requiredDate = z.coerce.date({ errorMap: () => ({ message: "Data inválida." }) });
const money = z.coerce.number({ invalid_type_error: "Valor inválido." }).min(0).max(1e12);

export const milestoneSchema = z.object({
  name: requiredText(200, "Marco"),
  kind: z.enum(["APROVACAO", "ENTREGA", "MARCO"]).default("MARCO"),
  plannedDate: requiredDate,
  actualDate: optionalDate,
  notes: optionalText(1000),
});

export const stageScheduleSchema = z.object({
  dependsOnIds: z.array(uuid).max(50).default([]),
  delayReason: optionalText(1000),
});

export const baselineSchema = z.object({ reason: requiredText(1000, "Motivo da linha de base") });

export const diarySchema = z.object({
  date: requiredDate,
  weather: optionalText(120),
  workforce: z.union([z.coerce.number().int().min(0).max(10000), z.literal(""), z.null()]).optional().transform((v) => (typeof v === "number" ? v : null)),
  activities: requiredText(4000, "Atividades executadas"),
  occurrences: optionalText(4000),
});

export const scopeChangeSchema = z.object({
  proposedScope: requiredText(4000, "Novo escopo"),
  proposedJustification: requiredText(4000, "Justificativa"),
  reason: requiredText(2000, "Motivo da mudança"),
});

const CATEGORIES = ["MATERIAIS", "SERVICOS", "MAO_DE_OBRA", "LOCACOES", "OUTRAS"] as const;

export const budgetSchema = z.object({
  reason: requiredText(1000, "Motivo"),
  contractId: uuid.optional().nullable().or(z.literal("").transform(() => null)),
  copyFromApproved: z.boolean().default(true),
});

export const budgetLineSchema = z.object({
  category: z.enum(CATEGORIES),
  description: requiredText(300, "Descrição"),
  unit: requiredText(20, "Unidade"),
  quantity: z.coerce.number().min(0).max(1e9),
  unitPrice: money,
  companyId: uuid.optional().nullable().or(z.literal("").transform(() => null)),
});

export const costEntrySchema = z.object({
  kind: z.enum(["CONTRATADO", "COMPROMETIDO", "PAGO"]),
  category: z.enum(CATEGORIES),
  lineKey: uuid.optional().nullable().or(z.literal("").transform(() => null)),
  amount: z.coerce.number().positive("Informe um valor positivo.").max(1e12),
  date: requiredDate,
  description: requiredText(500, "Descrição"),
  companyId: uuid.optional().nullable().or(z.literal("").transform(() => null)),
  contractId: uuid.optional().nullable().or(z.literal("").transform(() => null)),
  documentId: uuid.optional().nullable().or(z.literal("").transform(() => null)),
});

export const measurementSchema = z.object({
  periodStart: requiredDate,
  periodEnd: requiredDate,
  contractId: uuid.optional().nullable().or(z.literal("").transform(() => null)),
  notes: optionalText(2000),
  items: z.array(z.object({ lineKey: uuid, quantity: z.coerce.number().min(0).max(1e9), notes: optionalText(500) })).max(500).default([]),
}).refine((v) => v.periodEnd >= v.periodStart, { path: ["periodEnd"], message: "O fim do período deve ser posterior ao início." });

export const submitSchema = z.object({ note: optionalText(2000) });

export const tiersSchema = z.object({
  tiers: z.array(z.object({ upToAmount: z.union([z.null(), money]), stepsRequired: z.coerce.number().int().min(1).max(5) })).max(10),
});

export const settingSchema = z.object({ value: z.union([z.number(), z.string().max(500), z.boolean()]) });

export const privacyRequestSchema = z.object({
  subjectType: z.enum(["USUARIO", "PESSOA"]),
  subjectId: uuid,
  kind: z.enum(["ACESSO", "CORRECAO", "ANONIMIZACAO", "ELIMINACAO", "OPOSICAO", "INFORMACAO"]),
  channel: requiredText(120, "Canal"),
  details: requiredText(2000, "Descrição do pedido"),
});

export const privacyCloseSchema = z.object({
  status: z.enum(["ATENDIDA", "RECUSADA"]),
  resolution: requiredText(2000, "Resposta ao titular"),
  anonymize: z.boolean().default(false),
});
