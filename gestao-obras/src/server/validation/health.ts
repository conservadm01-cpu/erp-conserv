import { z } from "zod";
import { optionalText, requiredText } from "./common";

const optionalDate = z.union([z.coerce.date(), z.literal(""), z.null()]).optional().transform((v) => (v instanceof Date ? v : null));
const requiredDate = z.coerce.date({ errorMap: () => ({ message: "Informe uma data válida." }) });
/** Em formulários multipart a lista chega como texto separado por vírgulas. */
const codeList = z
  .union([z.array(z.string()), z.string()])
  .default([])
  .transform((v) => (Array.isArray(v) ? v : v.split(",")).map((x) => x.trim()).filter(Boolean))
  .pipe(z.array(z.string().max(40)).max(20));

export const healthCertificateSchema = z
  .object({
    examType: z.enum(["ADMISSIONAL", "PERIODICO", "RETORNO_TRABALHO", "MUDANCA_RISCO", "DEMISSIONAL", "OUTRO"]),
    result: z.enum(["APTO", "INAPTO"]),
    fitFor: codeList,
    examDate: requiredDate,
    expiryDate: optionalDate,
  })
  .superRefine((v, ctx) => {
    if (v.expiryDate && v.expiryDate < v.examDate) ctx.addIssue({ code: "custom", path: ["expiryDate"], message: "A validade deve ser posterior à data do exame." });
    if (v.examDate > new Date()) ctx.addIssue({ code: "custom", path: ["examDate"], message: "A data do exame não pode estar no futuro." });
    if (v.result === "INAPTO" && v.fitFor.length) ctx.addIssue({ code: "custom", path: ["fitFor"], message: "Resultado inapto não libera atividades." });
  });

/** Comprovante enviado pelo próprio titular: vira qualificação a conferir. */
export const selfCredentialSchema = z.object({
  kind: z.enum(["REGISTRO_CONSELHO", "QUALIFICACAO", "HABILITACAO", "CERTIFICADO", "TREINAMENTO", "EXPERIENCIA"]),
  name: requiredText(200, "Nome"),
  issuer: optionalText(200),
  issueDate: optionalDate,
  expiryDate: optionalDate,
});

export const linkUserSchema = z.object({ email: z.string().trim().toLowerCase().email("Informe um e-mail válido.").or(z.literal("")) });

export const personRuleUpdateSchema = z
  .object({
    action: z.enum(["validar", "inativar", "reativar"]),
    legalBasis: optionalText(500),
    sourceUrl: z.string().trim().url("Informe um endereço válido.").max(500).optional().or(z.literal("")).transform((v) => v || null),
    lastReviewedAt: optionalDate,
    blocking: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.action !== "validar") return;
    if (!v.legalBasis) ctx.addIssue({ code: "custom", path: ["legalBasis"], message: "Informe a base (legal, contratual ou institucional)." });
    if (!v.lastReviewedAt) ctx.addIssue({ code: "custom", path: ["lastReviewedAt"], message: "Informe a data da revisão." });
  });
