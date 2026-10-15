import { z } from "zod";
import { email, requiredText, uuid } from "./common";

export const createUserSchema = z.object({
  name: requiredText(200, "Nome"),
  email,
  homeUnitId: uuid,
  temporaryPassword: z.string().min(1, "Informe a senha provisória.").max(128),
});

export const updateUserSchema = z.object({
  name: requiredText(200, "Nome").optional(),
  homeUnitId: uuid.optional(),
});

export const userStatusSchema = z.object({
  status: z.enum(["ATIVO", "BLOQUEADO", "INATIVO"]),
  reason: requiredText(500, "Justificativa"),
});

export const addScopeSchema = z.object({
  roleId: uuid,
  unitId: uuid,
  includeDescendants: z.boolean().default(true),
});

export const temporaryPasswordSchema = z.object({
  temporaryPassword: z.string().min(1).max(128),
});

export const userListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["ATIVO", "BLOQUEADO", "INATIVO"]).optional(),
  unitId: uuid.optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
