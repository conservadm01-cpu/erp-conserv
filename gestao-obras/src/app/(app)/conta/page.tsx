import type { Metadata } from "next";
import { requirePageActor } from "@/server/auth/page-context";
import { prisma } from "@/server/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { MfaEnrollment } from "@/components/MfaEnrollment";
import { Alert } from "@/components/ui/Alert";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Minha conta" };

export default async function AccountPage() {
  const actor = await requirePageActor();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: actor.userId },
    select: { mfaEnabledAt: true, passwordChangedAt: true, _count: { select: { recoveryCodes: { where: { usedAt: null } } } } },
  });
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Minha conta" description={`${actor.name} · ${actor.email}`} />

      <section className="card p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Meus acessos</h2>
        {actor.scopes.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum acesso atribuído.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {actor.scopes.map((s) => (
              <li key={s.scopeId}><span className="font-medium">{s.roleName}</span> em {s.unitName}{s.includeDescendants ? " e subordinadas" : ""}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Verificação em duas etapas (MFA)</h2>
        {user.mfaEnabledAt ? (
          <Alert tone="success">
            MFA ativo desde {formatDateTime(user.mfaEnabledAt)}. Códigos de recuperação disponíveis: {user._count.recoveryCodes}.
            {user._count.recoveryCodes <= 2 && " Restam poucos códigos: solicite a redefinição do MFA a um administrador para gerar novos."}
          </Alert>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Recomendado para todos os usuários. Obrigatório para perfis críticos.</p>
            <MfaEnrollment afterDone="/conta" />
          </div>
        )}
      </section>

      <section className="card p-6">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">Alterar senha</h2>
        <p className="mb-4 text-xs text-slate-500">Última alteração: {formatDateTime(user.passwordChangedAt)}</p>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
