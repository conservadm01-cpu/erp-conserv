import type { Metadata } from "next";
import { requireState } from "@/components/AuthStateGuard";
import { MfaVerifyForm } from "./MfaVerifyForm";

export const metadata: Metadata = { title: "Verificação em duas etapas" };

export default async function MfaPage() {
  await requireState(["MFA_PENDENTE"]);
  return <MfaVerifyForm />;
}
