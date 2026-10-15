import type { Metadata } from "next";
import Link from "next/link";
import { requirePageActor } from "@/server/auth/page-context";
import { canAnywhere } from "@/server/authz/authorize";
import { getDashboard } from "@/server/services/dashboard.service";
import { PageHeader } from "@/components/ui/PageHeader";
import { Forbidden } from "@/components/Forbidden";
import { Alert } from "@/components/ui/Alert";

export const metadata: Metadata = { title: "Painel" };

function Stat({ label, value, href, tone = "default" }: { label: string; value: number; href?: string; tone?: "default" | "warn" }) {
  const body = (
    <div className={`card p-4 ${href ? "hover:border-brand-500" : ""}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone === "warn" && value > 0 ? "text-amber-700" : "text-slate-900"}`}>{value.toLocaleString("pt-BR")}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function DashboardPage() {
  const actor = await requirePageActor();
  if (!canAnywhere(actor, "dashboard.view")) return <Forbidden />;
  const d = await getDashboard(actor);
  return (
    <div className="space-y-8">
      <PageHeader title="Painel" description={<>Indicadores calculados a partir do banco de dados, limitados ao seu escopo de acesso.</>} />

      <section aria-labelledby="sec-org">
        <h2 id="sec-org" className="mb-3 text-sm font-semibold text-slate-700">Estrutura organizacional</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {d.units.map((u) => (
            <Stat key={u.typeCode} label={`${u.typeName} (ativas)`} value={u.ativas} href={canAnywhere(actor, "org.read") ? "/organizacao" : undefined} />
          ))}
        </div>
      </section>

      {d.users && (
        <section aria-labelledby="sec-users">
          <h2 id="sec-users" className="mb-3 text-sm font-semibold text-slate-700">Usuários</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Ativos" value={d.users.ativos} href="/usuarios" />
            <Stat label="Bloqueados" value={d.users.bloqueados} tone="warn" href="/usuarios?status=BLOQUEADO" />
            <Stat label="Inativos" value={d.users.inativos} href="/usuarios?status=INATIVO" />
            <Stat label="Ativos sem MFA" value={d.users.semMfa} tone="warn" />
          </div>
        </section>
      )}

      {d.deniedLast24h !== null && (
        <section aria-labelledby="sec-sec">
          <h2 id="sec-sec" className="mb-3 text-sm font-semibold text-slate-700">Segurança</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="Falhas e negativas (24h)" value={d.deniedLast24h} tone="warn" href="/auditoria?result=NEGADO" />
          </div>
        </section>
      )}

      <Alert tone="info" title="Fase 1 — fundação">
        Os indicadores de obras, documentos, inspeções, cronograma e orçamento serão incluídos nas próximas fases, à medida que os módulos forem implementados.
      </Alert>
    </div>
  );
}
