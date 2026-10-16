import type { Metadata } from "next";
import { requireState } from "@/components/AuthStateGuard";
import { MfaEnrollment } from "@/components/MfaEnrollment";
import { LogoutButton } from "@/components/LogoutButton";

export const metadata: Metadata = { title: "Cadastrar autenticador" };

export default async function MfaEnrollPage() {
  await requireState(["MFA_CADASTRO_OBRIGATORIO"]);
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Cadastre a verificação em duas etapas</h1>
      <p className="text-sm text-slate-600">O seu perfil de acesso exige MFA. Use um aplicativo autenticador compatível com TOTP.</p>
      <MfaEnrollment />
      <div className="text-right"><LogoutButton /></div>
    </div>
  );
}
