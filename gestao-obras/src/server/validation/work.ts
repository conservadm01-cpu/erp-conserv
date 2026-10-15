import { z } from "zod";
import { optionalText, requiredText, uuid } from "./common";
import { UF } from "./org-unit";

const optionalDate = z
  .union([z.coerce.date(), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v instanceof Date ? v : v === undefined ? undefined : null));

const dates = <T extends z.ZodRawShape>(shape: T) =>
  z.object(shape).superRefine((v: Record<string, unknown>, ctx) => {
    const s = v.plannedStart as Date | null | undefined;
    const e = v.plannedEnd as Date | null | undefined;
    if (s && e && e < s) ctx.addIssue({ code: "custom", path: ["plannedEnd"], message: "O término previsto deve ser posterior ao início." });
  });

const workFields = {
  title: requiredText(200, "Título"),
  typeCode: requiredText(40, "Tipo de obra"),
  activities: z.array(z.string().max(40)).max(30).default([]),
  priority: z.enum(["BAIXA", "MEDIA", "ALTA", "URGENTE"]).default("MEDIA"),
  executionMode: z.enum(["VOLUNTARIOS", "EMPRESA_CONTRATADA", "MISTA"]).default("VOLUNTARIOS"),
  scope: requiredText(4000, "Escopo"),
  justification: requiredText(4000, "Justificativa"),
  street: optionalText(200),
  number: optionalText(20),
  district: optionalText(120),
  city: optionalText(120),
  state: z.enum(UF).optional().nullable().or(z.literal("").transform(() => null)),
  postalCode: z.string().trim().regex(/^\d{5}-?\d{3}$/, "CEP inválido.").optional().nullable().or(z.literal("").transform(() => null)),
  plannedStart: optionalDate,
  plannedEnd: optionalDate,
  responsibleName: optionalText(200),
};

export const createWorkSchema = dates({ ...workFields, unitId: uuid });

export const updateWorkSchema = dates({
  ...Object.fromEntries(Object.entries(workFields).map(([k, v]) => [k, (v as z.ZodTypeAny).optional()])),
  version: z.number().int().min(1),
} as unknown as typeof workFields & { version: z.ZodNumber });

export const transitionSchema = z.object({
  action: z.string().trim().min(1).max(40),
  reason: optionalText(2000),
  version: z.number().int().min(1),
});

export const stageSchema = dates({
  name: requiredText(200, "Nome da etapa"),
  sortOrder: z.number().int().min(0).max(1000).default(0),
  status: z.enum(["NAO_INICIADA", "EM_ANDAMENTO", "CONCLUIDA", "CANCELADA"]).default("NAO_INICIADA"),
  plannedStart: optionalDate,
  plannedEnd: optionalDate,
  actualStart: optionalDate,
  actualEnd: optionalDate,
  progress: z.number().int().min(0).max(100).default(0),
  responsibleName: optionalText(200),
  notes: optionalText(2000),
});

export const workListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["RASCUNHO", "SOLICITADA", "EM_TRIAGEM", "EM_APROVACAO", "APROVADA", "EM_EXECUCAO", "SUSPENSA", "EM_VISTORIA", "CONCLUIDA", "REJEITADA", "ARQUIVADA"]).optional(),
  typeCode: z.string().max(40).optional(),
  unitId: uuid.optional(),
});

export type CreateWorkInput = z.infer<typeof createWorkSchema>;
export type UpdateWorkInput = Partial<CreateWorkInput> & { version: number };
export type StageInput = z.infer<typeof stageSchema>;
export type WorkListQuery = z.infer<typeof workListQuery>;
