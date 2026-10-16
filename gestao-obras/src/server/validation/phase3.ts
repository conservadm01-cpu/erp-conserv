import { z } from "zod";
import { email, optionalText, requiredText, uuid } from "./common";
import { UF } from "./org-unit";

export const optionalDate = z.union([z.coerce.date(), z.literal(""), z.null()]).optional().transform((v) => (v instanceof Date ? v : v === undefined ? undefined : null));
const requiredDate = z.coerce.date({ errorMap: () => ({ message: "Data inválida." }) });
const optEmail = email.optional().nullable().or(z.literal("").transform(() => null));

// --- Pessoas -----------------------------------------------------------------
export const personSchema = z
  .object({
    name: requiredText(200, "Nome"),
    category: z.enum(["PROFISSIONAL", "EMPREGADO", "VOLUNTARIO", "OUTRO"]),
    bondDescription: optionalText(300),
    legalReviewNote: optionalText(1000),
    internalId: optionalText(60),
    email: optEmail,
    phone: optionalText(30),
    jobFunction: optionalText(120),
    authorizedActivities: z.array(z.string().max(40)).max(30).default([]),
    companyId: uuid.optional().nullable().or(z.literal("").transform(() => null)),
    unitId: uuid,
  })
  .refine((v) => v.category !== "OUTRO" || Boolean(v.bondDescription), { path: ["bondDescription"], message: "Descreva o vínculo." });

export const updatePersonSchema = z.object({
  name: requiredText(200, "Nome").optional(),
  bondDescription: optionalText(300),
  legalReviewNote: optionalText(1000),
  internalId: optionalText(60),
  email: optEmail,
  phone: optionalText(30),
  jobFunction: optionalText(120),
  authorizedActivities: z.array(z.string().max(40)).max(30).optional(),
  companyId: uuid.optional().nullable().or(z.literal("").transform(() => null)),
  status: z.enum(["ATIVO", "INATIVO"]).optional(),
});

export const credentialSchema = z.object({
  kind: z.enum(["REGISTRO_CONSELHO", "QUALIFICACAO", "HABILITACAO", "CERTIFICADO", "TREINAMENTO", "INTEGRACAO_SEGURANCA", "EXPERIENCIA"]),
  name: requiredText(200, "Nome"),
  issuer: optionalText(200),
  number: optionalText(100),
  issueDate: optionalDate,
  expiryDate: optionalDate,
  documentId: uuid.optional().nullable().or(z.literal("").transform(() => null)),
});

export const verifySchema = z.object({ source: requiredText(300, "Fonte consultada") });

export const assignmentSchema = z.object({
  workId: uuid,
  role: requiredText(120, "Função na obra"),
  activities: z.array(z.string().max(40)).max(30).default([]),
  startDate: requiredDate,
  endDate: optionalDate,
  safetyBriefingAt: optionalDate,
  safetyBriefingNote: optionalText(1000),
});

export const updateAssignmentSchema = z.object({
  endDate: optionalDate,
  safetyBriefingAt: optionalDate,
  safetyBriefingNote: optionalText(1000),
  status: z.enum(["ATIVO", "INATIVO"]).optional(),
});

// --- Empresas e contratos ----------------------------------------------------
export function isValidCnpj(raw: string) {
  const c = raw.replace(/\D/g, "");
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((s, w, i) => s + Number(c[i]) * w, 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
}

const cnpj = z.string().transform((v) => v.replace(/\D/g, "")).refine(isValidCnpj, "CNPJ inválido.");

const companyFields = {
  legalName: requiredText(200, "Razão social"),
  tradeName: optionalText(200),
  email: optEmail,
  phone: optionalText(30),
  street: optionalText(200),
  number: optionalText(20),
  district: optionalText(120),
  city: optionalText(120),
  state: z.enum(UF).optional().nullable().or(z.literal("").transform(() => null)),
  postalCode: z.string().trim().regex(/^\d{5}-?\d{3}$/, "CEP inválido.").optional().nullable().or(z.literal("").transform(() => null)),
  services: optionalText(1000),
  contractManagerName: optionalText(200),
  technicalManagerName: optionalText(200),
};

const companyObject = z.object(companyFields);
export const companySchema = companyObject.extend({ cnpj, unitId: uuid });
export const updateCompanySchema = companyObject.partial().extend({ status: z.enum(["ATIVO", "INATIVO"]).optional() });

export const contractSchema = z.object({
  kind: z.enum(["CONTRATO", "ADITIVO", "ORDEM_SERVICO"]),
  number: requiredText(60, "Número"),
  object: requiredText(2000, "Objeto"),
  value: z.union([z.coerce.number().min(0).max(1e12), z.literal(""), z.null()]).optional().transform((v) => (typeof v === "number" ? v : null)),
  startDate: optionalDate,
  endDate: optionalDate,
  workId: uuid.optional().nullable().or(z.literal("").transform(() => null)),
  parentId: uuid.optional().nullable().or(z.literal("").transform(() => null)),
  status: z.enum(["RASCUNHO", "VIGENTE", "ENCERRADO", "CANCELADO"]).default("RASCUNHO"),
}).refine((v) => v.kind !== "ADITIVO" || Boolean(v.parentId), { path: ["parentId"], message: "Aditivo precisa do contrato original." });

// --- EPIs e equipamentos -----------------------------------------------------
export const epiCatalogSchema = z.object({
  name: requiredText(200, "Nome"),
  epiType: requiredText(120, "Tipo"),
  manufacturer: optionalText(200),
  model: optionalText(120),
  size: optionalText(30),
  caNumber: z.string().trim().regex(/^\d{1,10}$/, "Informe apenas os números do CA.").optional().nullable().or(z.literal("").transform(() => null)),
  caExpiry: optionalDate,
  shelfLifeMonths: z.union([z.coerce.number().int().min(1).max(600), z.literal(""), z.null()]).optional().transform((v) => (typeof v === "number" ? v : null)),
  minStock: z.coerce.number().int().min(0).max(100000).default(0),
  indicatedFor: z.array(z.string().max(40)).max(30).default([]),
  status: z.enum(["ATIVO", "INATIVO"]).default("ATIVO"),
});

export const stockMovementSchema = z.object({
  catalogId: uuid,
  unitId: uuid,
  type: z.enum(["ENTRADA", "BAIXA", "AJUSTE"]),
  quantity: z.coerce.number().int().min(-100000).max(100000).refine((n) => n !== 0, "Quantidade não pode ser zero."),
  lot: optionalText(60),
  expiryDate: optionalDate,
  note: optionalText(500),
});

export const deliverySchema = z.object({
  catalogId: uuid,
  personId: uuid,
  unitId: uuid,
  workId: uuid.optional().nullable().or(z.literal("").transform(() => null)),
  quantity: z.coerce.number().int().min(1).max(1000),
  lot: optionalText(60),
  deliveredAt: requiredDate,
  receipt: z.enum(["TERMO_FISICO_ARQUIVADO", "CONFIRMACAO_PRESENCIAL_REGISTRADA", "PENDENTE"]).default("PENDENTE"),
  receiptNote: optionalText(500),
  replacesId: uuid.optional().nullable().or(z.literal("").transform(() => null)),
  replacementReason: optionalText(300),
}).refine((v) => !v.replacesId || Boolean(v.replacementReason), { path: ["replacementReason"], message: "Informe o motivo da substituição." });

export const returnSchema = z.object({
  returnedAt: requiredDate,
  returnedQuantity: z.coerce.number().int().min(1).max(1000),
  returnCondition: requiredText(300, "Condição"),
  restock: z.boolean().default(false),
});

export const receiptSchema = z.object({
  receipt: z.enum(["TERMO_FISICO_ARQUIVADO", "CONFIRMACAO_PRESENCIAL_REGISTRADA"]),
  receiptNote: optionalText(500),
});

export const equipmentSchema = z.object({
  kind: z.enum(["FERRAMENTA", "EQUIPAMENTO_COLETIVO", "MAQUINA", "EPI_DURAVEL"]),
  name: requiredText(200, "Nome"),
  identifier: optionalText(80),
  manufacturer: optionalText(200),
  model: optionalText(120),
  unitId: uuid,
  inspectionIntervalDays: z.union([z.coerce.number().int().min(1).max(3650), z.literal(""), z.null()]).optional().transform((v) => (typeof v === "number" ? v : null)),
  maintenanceIntervalDays: z.union([z.coerce.number().int().min(1).max(3650), z.literal(""), z.null()]).optional().transform((v) => (typeof v === "number" ? v : null)),
  nextInspectionAt: optionalDate,
  nextMaintenanceAt: optionalDate,
});

export const equipmentLogSchema = z.object({
  type: z.enum(["INSPECAO", "MANUTENCAO", "DEFEITO"]),
  date: requiredDate,
  approved: z.boolean().nullable().optional(),
  notes: requiredText(2000, "Registro"),
  interdict: z.boolean().default(false),
});

export const equipmentStatusSchema = z.object({ status: z.enum(["DISPONIVEL", "EM_USO", "EM_MANUTENCAO", "INTERDITADO", "BAIXADO"]), reason: requiredText(500, "Justificativa") });

// --- Segurança ---------------------------------------------------------------
export const criticalitySchema = z.object({
  name: requiredText(60, "Nome"),
  responseDays: z.coerce.number().int().min(0).max(365),
  priorityAlert: z.boolean(),
  blocksProgress: z.boolean(),
});

export const checklistSchema = z.object({
  name: requiredText(200, "Nome"),
  workTypes: z.array(z.string().max(40)).max(30).default([]),
  active: z.boolean().default(true),
  items: z.array(z.object({ text: requiredText(500, "Item"), defaultCriticality: z.string().max(20) })).min(1, "Inclua ao menos um item.").max(200),
});

export const inspectionSchema = z.object({
  workId: uuid,
  templateId: uuid.optional().nullable().or(z.literal("").transform(() => null)),
  title: requiredText(200, "Título"),
  plannedDate: requiredDate,
  location: optionalText(200),
});

export const inspectionItemsSchema = z.object({
  items: z.array(z.object({
    id: uuid,
    result: z.enum(["PENDENTE", "CONFORME", "NAO_CONFORME", "NAO_APLICAVEL"]),
    criticality: z.string().max(20),
    observation: optionalText(2000),
    documentIds: z.array(uuid).max(20).default([]),
  })).max(200),
  extraItems: z.array(z.object({ text: requiredText(500, "Item"), criticality: z.string().max(20) })).max(50).default([]),
});

export const completeInspectionSchema = z.object({ summary: requiredText(4000, "Conclusão"), location: optionalText(200) });

export const riskSchema = z.object({
  workId: uuid,
  title: requiredText(200, "Risco"),
  description: optionalText(2000),
  activity: optionalText(40),
  criticality: z.string().max(20),
  controls: optionalText(2000),
});

export const updateRiskSchema = z.object({
  controls: optionalText(2000),
  criticality: z.string().max(20).optional(),
  status: z.enum(["ABERTO", "CONTROLADO", "ENCERRADO"]).optional(),
});

export const incidentSchema = z.object({
  workId: uuid,
  type: z.enum(["INCIDENTE", "QUASE_ACIDENTE", "ACIDENTE"]),
  occurredAt: requiredDate,
  location: optionalText(200),
  description: requiredText(4000, "Descrição"),
  immediateActions: optionalText(2000),
  criticality: z.string().max(20),
});

export const actionSchema = z.object({
  workId: uuid,
  title: requiredText(200, "Ação"),
  description: optionalText(2000),
  criticality: z.string().max(20),
  responsibleName: requiredText(200, "Responsável"),
  responsibleUserId: uuid.optional().nullable().or(z.literal("").transform(() => null)),
  dueDate: optionalDate,
  riskId: uuid.optional().nullable().or(z.literal("").transform(() => null)),
  incidentId: uuid.optional().nullable().or(z.literal("").transform(() => null)),
});

export const actionStepSchema = z.object({
  step: z.enum(["INICIAR", "ENVIAR_EVIDENCIA", "VALIDAR", "REPROVAR", "CANCELAR"]),
  evidence: optionalText(4000),
  evidenceDocumentIds: z.array(uuid).max(20).default([]),
  note: optionalText(2000),
});
