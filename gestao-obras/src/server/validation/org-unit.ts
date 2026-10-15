import { z } from "zod";
import { email, optionalText, requiredText, uuid } from "./common";

const UF = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"] as const;

export const contactSchema = z.object({
  name: requiredText(200, "Nome do contato"),
  role: optionalText(120),
  email: email.optional().nullable().or(z.literal("").transform(() => null)),
  phone: optionalText(30),
});

const addressFields = {
  street: optionalText(200),
  number: optionalText(20),
  complement: optionalText(100),
  district: optionalText(120),
  city: optionalText(120),
  state: z.enum(UF).optional().nullable().or(z.literal("").transform(() => null)),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}-?\d{3}$/, "CEP inválido.")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
};

export const createOrgUnitSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9-]{1,39}$/, "Código: letras, números e hífen (2 a 40)."),
  name: requiredText(200, "Nome"),
  typeCode: requiredText(40, "Tipo"),
  parentId: uuid,
  ...addressFields,
  contacts: z.array(contactSchema).max(20).default([]),
});

export const updateOrgUnitSchema = z.object({
  name: requiredText(200, "Nome").optional(),
  parentId: uuid.optional(),
  ...addressFields,
  contacts: z.array(contactSchema).max(20).optional(),
});

export const orgUnitStatusSchema = z.object({
  status: z.enum(["ATIVA", "INATIVA"]),
  reason: requiredText(500, "Justificativa"),
});

export type CreateOrgUnitInput = z.infer<typeof createOrgUnitSchema>;
export type UpdateOrgUnitInput = z.infer<typeof updateOrgUnitSchema>;
export { UF };
