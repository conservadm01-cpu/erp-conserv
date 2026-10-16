import type { Metadata } from "next";
import { requireState } from "@/components/AuthStateGuard";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { LogoutButton } from "@/components/LogoutButton";

export const metadata: Metadata = { title: "Trocar senha" };

export default async function ChangePasswordPage() {
  await requireState(["TROCA_SENHA_OBRIGATORIA"]);
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Defina uma nova senha</h1>
      <p className="text-sm text-slate-600">Você entrou com uma senha provisória. Por segurança, escolha uma senha pessoal.</p>
      <ChangePasswordForm redirectTo="/" />
      <div className="text-right"><LogoutButton /></div>
    </div>
  );
}
