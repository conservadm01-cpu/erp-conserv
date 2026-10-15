import { z } from "zod";
import { optionalText, requiredText } from "./common";

export const createRoleSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9_]{2,59}$/, "Código: letras maiúsculas, números e sublinhado."),
  name: requiredText(120, "Nome"),
  description: optionalText(500),
  requiresMfa: z.boolean().default(false),
  permissions: z.array(z.string().max(80)).max(200).default([]),
});

export const updateRoleSchema = z.object({
  name: requiredText(120, "Nome").optional(),
  description: optionalText(500),
  requiresMfa: z.boolean().optional(),
  permissions: z.array(z.string().max(80)).max(200).optional(),
});
