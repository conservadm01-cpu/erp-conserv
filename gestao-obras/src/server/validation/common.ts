import "./zod-pt";
import { z } from "zod";

export const uuid = z.string().uuid("Identificador inválido.");
export const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .email("Informe um e-mail válido.");
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));
export const requiredText = (max: number, label = "Campo") =>
  z.string().trim().min(1, `${label} é obrigatório.`).max(max, `Máximo de ${max} caracteres.`);
