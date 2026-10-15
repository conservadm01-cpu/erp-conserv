import { z } from "zod";
import { uuid } from "./common";

export const decisionSchema = z.object({
  decision: z.enum(["APROVAR", "REJEITAR", "DEVOLVER"]),
  opinion: z.string().trim().min(10, "Registre o parecer (mínimo de 10 caracteres).").max(4000),
  consultedDocumentIds: z.array(uuid).max(200).default([]),
});

export const policySchema = z.object({
  stepsRequired: z.number().int().min(1).max(5),
  requireSegregation: z.boolean(),
});
