import { z, ZodIssueCode, type ZodErrorMap } from "zod";

/** Mensagens padrão de validação em português. */
const ptErrorMap: ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      return { message: issue.received === "undefined" || issue.received === "null" ? "Campo obrigatório." : "Valor em formato inválido." };
    case ZodIssueCode.invalid_enum_value:
      return { message: "Opção inválida." };
    case ZodIssueCode.too_small:
      return { message: issue.type === "string" ? `Mínimo de ${issue.minimum} caracteres.` : "Valor abaixo do mínimo." };
    case ZodIssueCode.too_big:
      return { message: issue.type === "string" ? `Máximo de ${issue.maximum} caracteres.` : "Valor acima do máximo." };
    case ZodIssueCode.invalid_string:
      return { message: "Formato inválido." };
    case ZodIssueCode.invalid_date:
      return { message: "Data inválida." };
    case ZodIssueCode.unrecognized_keys:
      return { message: "Campos não reconhecidos." };
    default:
      return { message: ctx.defaultError };
  }
};

z.setErrorMap(ptErrorMap);
