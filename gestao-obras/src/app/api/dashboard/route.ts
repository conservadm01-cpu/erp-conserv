import { z } from "zod";
import { authedRoute, json, readQuery } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { getDashboard } from "@/server/services/dashboard.service";

const query = z.object({
  unitId: uuid.optional(),
  typeCode: z.string().max(40).optional(),
  status: z.enum(["RASCUNHO", "SOLICITADA", "EM_TRIAGEM", "EM_APROVACAO", "APROVADA", "EM_EXECUCAO", "SUSPENSA", "EM_VISTORIA", "CONCLUIDA", "REJEITADA", "ARQUIVADA"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const GET = authedRoute(async ({ req, actor }) => json(await getDashboard(actor, readQuery(req, query))));
