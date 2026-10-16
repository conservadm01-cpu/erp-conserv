import { prisma } from "../db";
import { recordAudit } from "../audit/audit";
import { assertCan, type Actor } from "../authz/authorize";
import { Errors } from "../http/errors";
import type { RequestMeta } from "../http/request-meta";
import { getRootUnit } from "./org-unit.service";

/** Valores padrão usados quando o parâmetro ainda não foi gravado. */
export const SETTING_DEFAULTS = {
  "budget.deviationAlertPercent": 10,
  "retention.loginAttemptsDays": 180,
  "retention.sessionsDays": 90,
  "privacy.responseDays": 15,
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

export const SETTING_LABELS: Record<SettingKey, { label: string; hint: string; min: number; max: number }> = {
  "budget.deviationAlertPercent": { label: "Alerta de desvio orçamentário (%)", hint: "Alerta quando o medido ou comprometido de uma categoria supera o orçado nesta proporção.", min: 0, max: 100 },
  "retention.loginAttemptsDays": { label: "Retenção de tentativas de login (dias)", hint: "Registros de tentativas mais antigos são descartados pela rotina diária.", min: 30, max: 3650 },
  "retention.sessionsDays": { label: "Retenção de sessões encerradas (dias)", hint: "Sessões expiradas ou revogadas mais antigas são descartadas.", min: 7, max: 3650 },
  "privacy.responseDays": { label: "Prazo interno de resposta a titulares (dias)", hint: "Usado para calcular o vencimento das solicitações. Confirme o prazo legal vigente.", min: 1, max: 90 },
};

export async function getSetting<K extends SettingKey>(key: K): Promise<number> {
  const s = await prisma.systemSetting.findUnique({ where: { key } });
  return typeof s?.value === "number" ? s.value : SETTING_DEFAULTS[key];
}

export async function listSettings() {
  const rows = await prisma.systemSetting.findMany();
  return (Object.keys(SETTING_DEFAULTS) as SettingKey[]).map((key) => {
    const r = rows.find((x) => x.key === key);
    return { key, value: typeof r?.value === "number" ? r.value : SETTING_DEFAULTS[key], ...SETTING_LABELS[key], updatedAt: r?.updatedAt ?? null };
  });
}

export async function updateSetting(actor: Actor, key: string, value: unknown, meta: RequestMeta) {
  const root = await getRootUnit();
  if (!root) throw Errors.conflict("Estrutura organizacional não inicializada.");
  assertCan(actor, "settings.manage", root.path, "Parâmetros do sistema são alterados pela gestão central.");
  if (!(key in SETTING_DEFAULTS)) throw Errors.notFound("Parâmetro");
  const def = SETTING_LABELS[key as SettingKey];
  if (typeof value !== "number" || !Number.isFinite(value) || value < def.min || value > def.max) throw Errors.invalid(`Informe um número entre ${def.min} e ${def.max}.`, { value: ["Valor fora do limite."] });
  const before = await getSetting(key as SettingKey);
  return prisma.$transaction(async (tx) => {
    const s = await tx.systemSetting.upsert({ where: { key }, update: { value, updatedById: actor.userId }, create: { key, value, updatedById: actor.userId } });
    await recordAudit({ action: "sistema.parametro.alterado", actor: { userId: actor.userId, email: actor.email }, objectType: "SystemSetting", objectId: key, metadata: { antes: before, depois: value } }, meta, tx);
    return s;
  });
}
