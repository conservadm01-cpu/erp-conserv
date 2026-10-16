import { z } from "zod";
import { optionalText, requiredText, uuid } from "./common";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data.");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Informe o horário (hh:mm).");

/** Horário informado em Brasília (UTC−3; não há horário de verão desde 2019). */
export function brasiliaDate(date: string, hhmm: string) {
  return new Date(`${date}T${hhmm}:00-03:00`);
}

export const agendaEventSchema = z
  .object({
    unitId: uuid,
    workId: uuid.optional().nullable().or(z.literal("").transform(() => null)),
    kind: z.enum(["MUTIRAO", "VISITA_TECNICA", "ENTREGA_MATERIAL", "REUNIAO", "INSPECAO", "INTEGRACAO_SEGURANCA", "OUTRO"]),
    title: requiredText(200, "Título"),
    date: day,
    startTime: time,
    endTime: time.optional().or(z.literal("").transform(() => undefined)),
    location: optionalText(200),
    notes: optionalText(2000),
    slots: z.union([z.coerce.number().int().min(1, "Mínimo de 1 vaga.").max(500), z.literal("").transform(() => null), z.null()]).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.endTime && v.endTime < v.startTime) ctx.addIssue({ code: "custom", path: ["endTime"], message: "O término deve ser depois do início." });
  })
  .transform(({ date, startTime, endTime, ...rest }) => ({
    ...rest,
    startsAt: brasiliaDate(date, startTime),
    endsAt: endTime ? brasiliaDate(date, endTime) : null,
  }));

export const agendaStatusSchema = z
  .object({ status: z.enum(["REALIZADO", "CANCELADO"]), reason: optionalText(1000) })
  .refine((v) => v.status !== "CANCELADO" || (v.reason && v.reason.length >= 5), { path: ["reason"], message: "Informe o motivo do cancelamento." });

export const agendaQuery = z.object({
  unitId: uuid.optional(),
  mes: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});
