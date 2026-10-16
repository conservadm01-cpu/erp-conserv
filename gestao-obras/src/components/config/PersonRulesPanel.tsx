import { Badge } from "../ui/Badge";
import { ActionButton, EntityForm, Reveal } from "../ui/EntityForm";
import { formatDay } from "@/lib/format";

type Rule = { id: string; code: string; name: string; activityName: string; kind: string; status: string; blocking: boolean; legalBasis: string | null; sourceUrl: string | null; lastReviewedAt: Date | null };

/** Exigências por atividade para as pessoas (treinamentos, ASO). */
export function PersonRulesPanel({ rules, canManage }: { rules: Rule[]; canManage: boolean }) {
  return (
    <ul className="space-y-3">
      {rules.map((r) => (
        <li key={r.id} className="card space-y-2 p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">{r.activityName}: {r.name}</p>
            <span className="flex flex-wrap gap-1">
              <Badge tone={r.status === "VALIDADA" ? "green" : r.status === "INATIVA" ? "slate" : "amber"}>{r.status === "VALIDADA" ? "validada" : r.status === "INATIVA" ? "inativa" : "pendente de validação"}</Badge>
              {r.blocking && <Badge tone="red">bloqueia vínculo</Badge>}
              <Badge>{r.kind === "SAUDE" ? "ASO" : "treinamento/qualificação"}</Badge>
            </span>
          </div>
          <p className="text-xs text-slate-500"><span className="font-mono">{r.code}</span>{r.legalBasis ? ` · base: ${r.legalBasis}` : " · base ainda não registrada"}{r.lastReviewedAt ? ` · revisada em ${formatDay(r.lastReviewedAt)}` : ""}{r.sourceUrl ? ` · fonte: ${r.sourceUrl}` : ""}</p>
          {canManage && (
            <div className="flex flex-wrap gap-2">
              {r.status === "PENDENTE_VALIDACAO" && (
                <Reveal label="Validar" variant="secondary">
                  <EntityForm
                    action={`/api/person-rules/${r.id}`}
                    method="PATCH"
                    submitLabel="Registrar validação"
                    fixed={{ action: "validar" }}
                    fields={[
                      { name: "legalBasis", label: "Base legal, contratual ou institucional (como consta na fonte)", required: true, span: 2, maxLength: 500 },
                      { name: "sourceUrl", label: "Endereço da fonte consultada", type: "url" },
                      { name: "lastReviewedAt", label: "Data da revisão", type: "date", required: true },
                      { name: "blocking", label: "Impedir vínculos de quem não atende", type: "checkbox" },
                    ]}
                  />
                </Reveal>
              )}
              {r.status !== "INATIVA" ? (
                <ActionButton label="Inativar" variant="ghost" method="PATCH" action={`/api/person-rules/${r.id}`} body={{ action: "inativar" }} confirmText="Inativar esta exigência?" />
              ) : (
                <ActionButton label="Reativar (volta a pendente)" variant="ghost" method="PATCH" action={`/api/person-rules/${r.id}`} body={{ action: "reativar" }} />
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
