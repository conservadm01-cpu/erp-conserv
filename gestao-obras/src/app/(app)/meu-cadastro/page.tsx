import type { Metadata } from "next";
import { requirePageActor } from "@/server/auth/page-context";
import { canAnywhere } from "@/server/authz/authorize";
import { getMyProfile } from "@/server/services/health.service";
import { PageHeader } from "@/components/ui/PageHeader";
import { Forbidden } from "@/components/Forbidden";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Reveal } from "@/components/ui/EntityForm";
import { ComplianceList, HealthList } from "@/components/people/PeoplePanels";
import { HealthForm } from "@/components/people/HealthForm";
import { CredentialUploadForm } from "@/components/people/CredentialUploadForm";
import { DownloadButton } from "@/components/people/DownloadButton";
import { CREDENTIAL_KIND, PERSON_CATEGORY } from "@/components/phase3/labels";
import { WORK_STATUS } from "@/components/works/labels";
import { formatDay } from "@/lib/format";
import { AppError } from "@/server/http/errors";
import { myAgenda } from "@/server/services/agenda.service";

export const metadata: Metadata = { title: "Meu cadastro" };

export default async function MyProfilePage() {
  const actor = await requirePageActor();
  if (!canAnywhere(actor, "self.portal")) return <Forbidden />;
  let data;
  try {
    data = await getMyProfile(actor);
  } catch (e) {
    if (e instanceof AppError && e.status === 404) {
      return (
        <div className="max-w-3xl space-y-4">
          <PageHeader title="Meu cadastro" />
          <Alert tone="info">Sua conta ainda não foi vinculada a um cadastro de pessoa. Peça ao responsável pela sua unidade para fazer o vínculo.</Alert>
        </div>
      );
    }
    throw e;
  }
  const { person: p, compliance, activities } = data;
  const agenda = await myAgenda(p.id, p.unitId);
  const today = new Date().toISOString().slice(0, 10);
  const acts = activities.map((a) => ({ code: a.code, name: a.name }));
  const pending = compliance.filter((c) => !c.met).length;
  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title="Meu cadastro" description={`${p.name} · ${PERSON_CATEGORY[p.category]} · ${p.unit.name}`} />
      {pending > 0 ? (
        <Alert tone="warning" title={`${pending} pendência(s)`}>Envie os comprovantes abaixo. Eles serão conferidos pelo responsável antes de valer.</Alert>
      ) : compliance.length > 0 ? (
        <Alert tone="success">Seus registros atendem às exigências das atividades em que você atua.</Alert>
      ) : null}

      <section className="card space-y-3 p-6" aria-labelledby="pend">
        <h2 id="pend" className="text-sm font-semibold text-slate-700">Exigências das minhas atividades</h2>
        <ComplianceList items={compliance} empty="Nenhuma exigência cadastrada para as suas atividades." />
      </section>

      <section className="card space-y-3 p-6" aria-labelledby="qual">
        <h2 id="qual" className="text-sm font-semibold text-slate-700">Treinamentos, qualificações e experiência</h2>
        {p.credentials.length === 0 ? <p className="text-sm text-slate-500">Nenhum registro.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {p.credentials.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium">{c.name} {c.status === "INATIVO" && <Badge>inativo</Badge>} {c.expiryDate && c.expiryDate.toISOString().slice(0, 10) < today && <Badge tone="red">vencido</Badge>}</p>
                  <p className="text-xs text-slate-500">{CREDENTIAL_KIND[c.kind]}{c.issuer ? ` · ${c.issuer}` : ""} · validade {formatDay(c.expiryDate)} · {c.verifiedAt ? "conferido" : "aguardando conferência"}</p>
                </div>
                {c.document?.versions[0] && <DownloadButton documentId={c.document.id} versionId={c.document.versions[0].id} />}
              </li>
            ))}
          </ul>
        )}
        <Reveal label="Enviar comprovante"><CredentialUploadForm /></Reveal>
      </section>

      <section className="card space-y-3 p-6" aria-labelledby="aso">
        <h2 id="aso" className="text-sm font-semibold text-slate-700">Meu ASO</h2>
        <p className="text-xs text-slate-500">Só você e as pessoas com permissão de saúde ocupacional veem esta seção. Informe apenas a conclusão do atestado; não envie exames nem laudos.</p>
        <HealthList certs={p.healthCertificates} activities={acts} canManage={false} />
        <Reveal label="Enviar ASO"><HealthForm action="/api/me/health" activities={acts} allowChecked={false} fileRequired /></Reveal>
      </section>

      <section className="card space-y-3 p-6" aria-labelledby="agenda">
        <h2 id="agenda" className="text-sm font-semibold text-slate-700">Próximos compromissos</h2>
        {agenda.length === 0 ? <p className="text-sm text-slate-500">Nenhum compromisso agendado nas suas obras ou mutirões da sua unidade.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {agenda.map((e) => (
              <li key={e.id} className="py-2">
                <p className="font-medium">{e.startsAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {e.title}</p>
                <p className="text-xs text-slate-500">{e.unit.name}{e.work ? ` · ${e.work.code} — ${e.work.title}` : ""}{e.location ? ` · ${e.location}` : ""}</p>
                {e.notes && <p className="mt-1 whitespace-pre-line text-xs text-slate-600">{e.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-3 p-6" aria-labelledby="obras">
        <h2 id="obras" className="text-sm font-semibold text-slate-700">Obras em que atuo</h2>
        {p.assignments.length === 0 ? <p className="text-sm text-slate-500">Nenhuma obra.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {p.assignments.map((a) => (
              <li key={a.id} className="py-2">
                <p className="font-medium">{a.work.code} — {a.work.title} <Badge>{WORK_STATUS[a.work.status]?.label ?? a.work.status}</Badge> {a.status === "INATIVO" && <Badge>encerrado</Badge>}</p>
                <p className="text-xs text-slate-500">{a.role} · {formatDay(a.startDate)} a {formatDay(a.endDate)} · integração de segurança: {a.safetyBriefingAt ? formatDay(a.safetyBriefingAt) : "pendente"}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
