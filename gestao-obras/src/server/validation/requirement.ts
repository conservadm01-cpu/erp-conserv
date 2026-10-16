import { z } from "zod";
import { optionalText, requiredText, uuid } from "./common";

const CLASSIFICATIONS = ["LEGAL_OBRIGATORIO", "LEGAL_CONDICIONAL", "CONTRATUAL", "INSTITUCIONAL_APROVADO", "BOA_PRATICA", "INFORMATIVO"] as const;
const CHECKPOINTS = ["TRIAGEM", "APROVACAO", "INICIO_EXECUCAO", "VISTORIA", "ENCERRAMENTO"] as const;
const optionalDate = z.union([z.coerce.date(), z.literal(""), z.null()]).optional().transform((v) => (v instanceof Date ? v : v === undefined ? undefined : null));

export const ruleSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9_-]{1,39}$/, "Código: letras, números, hífen e sublinhado."),
  name: requiredText(200, "Nome do requisito"),
  description: optionalText(2000),
  workTypes: z.array(z.string().max(40)).max(30).default([]),
  activities: z.array(z.string().max(40)).max(30).default([]),
  executionModes: z.array(z.enum(["VOLUNTARIOS", "EMPRESA_CONTRATADA", "MISTA"])).max(3).default([]),
  applicabilityNote: optionalText(2000),
  evidence: requiredText(500, "Documento ou evidência exigida"),
  documentCategoryCode: optionalText(40),
  classification: z.enum(CLASSIFICATIONS),
  legalBasis: optionalText(500),
  sourceUrl: z.string().trim().url("URL inválida.").max(500).optional().nullable().or(z.literal("").transform(() => null)),
  normVersion: optionalText(100),
  checkpoint: z.enum(CHECKPOINTS),
  blocking: z.boolean().default(false),
  nextReviewAt: optionalDate,
});

export const updateRuleSchema = ruleSchema.omit({ code: true }).partial();

export const validateRuleSchema = z.object({
  lastReviewedAt: z.coerce.date(),
  nextReviewAt: z.coerce.date(),
  note: requiredText(1000, "Registro da validação"),
});

export const evaluationSchema = z.object({
  status: z.enum(["PENDENTE", "ATENDIDO", "NAO_ATENDIDO"]),
  documentId: uuid.optional().nullable(),
  justification: optionalText(2000),
});

export const waiveSchema = z.object({ justification: z.string().trim().min(20, "Justifique com pelo menos 20 caracteres.").max(2000) });

export type RuleInput = z.infer<typeof ruleSchema>;
