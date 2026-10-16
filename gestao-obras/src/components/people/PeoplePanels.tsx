import { Badge } from "../ui/Badge";
import { ActionButton } from "../ui/EntityForm";
import { HEALTH_EXAM, HEALTH_STATUS } from "../phase3/labels";
import { DownloadButton } from "./DownloadButton";
import { formatDateTime, formatDay } from "@/lib/format";

type Compliance = { ruleId: string; name: string; activityName: string; met: boolean; detail: string; validated: boolean; blocking: boolean };

/** Situação da pessoa frente às exigências das atividades que exerce ou está autorizada a exercer. */
export function ComplianceList({ items, empty }: { items: Compliance[]; empty: string }) {
  if (!items.length) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="divide-y divide-slate-100 text-sm">
      {items.map((c) => (
        <li key={c.ruleId} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-medium">{c.activityName}: {c.name}</p>
            <p className="text-xs text-slate-500">{c.detail}</p>
          </div>
          <div className="flex flex-wrap gap-1">
            <Badge tone={c.met ? "green" : c.blocking ? "red" : "amber"}>{c.met ? "atendido" : c.blocking ? "pendente — bloqueia vínculo" : "pendente"}</Badge>
            {!c.validated && <Badge>exigência pendente de validação</Badge>}
          </div>
        </li>
      ))}
    </ul>
  );
}

type Cert = { id: string; examType: string; result: string; fitFor: string[]; examDate: Date; expiryDate: Date | null; status: string; checkedAt: Date | null; document: { id: string; versions: { id: string }[] } | null };

export function HealthList({ certs, activities, personId, canManage }: { certs: Cert[]; activities: { code: string; name: string }[]; personId?: string; canManage: boolean }) {
  const today = new Date().toISOString().slice(0, 10);
  if (!certs.length) return <p className="text-sm text-slate-500">Nenhum ASO registrado.</p>;
  const name = (code: string) => activities.find((a) => a.code === code)?.name ?? code;
  return (
    <ul className="divide-y divide-slate-100 text-sm">
      {certs.map((h) => {
        const expired = h.expiryDate && h.expiryDate.toISOString().slice(0, 10) < today;
        return (
          <li key={h.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-medium">
                ASO {HEALTH_EXAM[h.examType]?.toLowerCase()} de {formatDay(h.examDate)} · {h.result === "APTO" ? "Apto" : "Inapto"}{" "}
                <Badge tone={h.status === "CONFERIDO" ? "green" : h.status === "INATIVO" ? "slate" : "amber"}>{HEALTH_STATUS[h.status]}</Badge> {expired && <Badge tone="red">vencido</Badge>}
              </p>
              <p className="text-xs text-slate-500">
                {h.fitFor.length ? `Atividades: ${h.fitFor.map(name).join(", ")}` : "Sem atividades liberadas"} · validade {formatDay(h.expiryDate)}{h.checkedAt ? ` · conferido em ${formatDateTime(h.checkedAt)}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {h.document?.versions[0] && <DownloadButton documentId={h.document.id} versionId={h.document.versions[0].id} />}
              {canManage && personId && h.status === "PENDENTE_CONFERENCIA" && <ActionButton label="Conferir" variant="primary" method="PATCH" action={`/api/people/${personId}/health/${h.id}`} body={{ decision: "CONFERIR" }} confirmText="Confirma que conferiu o documento original?" />}
              {canManage && personId && h.status !== "INATIVO" && <ActionButton label="Inativar" variant="ghost" method="PATCH" action={`/api/people/${personId}/health/${h.id}`} body={{ decision: "INATIVAR" }} confirmText="Inativar este ASO?" />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
