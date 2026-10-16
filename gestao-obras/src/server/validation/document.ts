import { z } from "zod";
import { optionalText, requiredText } from "./common";

const optionalDate = z.union([z.coerce.date(), z.literal(""), z.null()]).optional().transform((v) => (v instanceof Date ? v : null));

export const documentMetaSchema = z
  .object({
    categoryCode: requiredText(40, "Categoria"),
    title: requiredText(200, "Título"),
    issuer: optionalText(200),
    documentNumber: optionalText(100),
    issueDate: optionalDate,
    expiryDate: optionalDate,
  })
  .superRefine((v, ctx) => {
    if (v.issueDate && v.expiryDate && v.expiryDate < v.issueDate) ctx.addIssue({ code: "custom", path: ["expiryDate"], message: "A validade deve ser posterior à emissão." });
  });

export const newVersionMetaSchema = z.object({
  changeNote: requiredText(500, "Motivo da substituição"),
  expiryDate: optionalDate,
});

export const reviewSchema = z.object({
  decision: z.enum(["INICIAR", "APROVAR", "REJEITAR"]),
  note: optionalText(2000),
});

export const documentSearchQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["ENVIADO", "EM_REVISAO", "APROVADO", "REJEITADO", "VENCIDO", "SUBSTITUIDO"]).optional(),
  categoryCode: z.string().max(40).optional(),
  expiring: z.enum(["30"]).optional(),
});

export type DocumentMeta = z.infer<typeof documentMetaSchema>;
