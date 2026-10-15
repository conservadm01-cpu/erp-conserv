import { requirePageActor } from "@/server/auth/page-context";
import { canAnywhere } from "@/server/authz/authorize";
import type { PermissionCode } from "@/server/authz/catalog";
import { AppShell, type NavItem } from "@/components/layout/AppShell";

export const dynamic = "force-dynamic";

const NAV: (NavItem & { permission?: PermissionCode })[] = [
  { href: "/", label: "Painel", permission: "dashboard.view" },
  { href: "/obras", label: "Obras", permission: "work.read" },
  { href: "/documentos", label: "Documentos", permission: "document.read" },
  { href: "/aprovacoes", label: "Aprovações", permission: "approval.decide" },
  { href: "/organizacao", label: "Estrutura organizacional", permission: "org.read" },
  { href: "/usuarios", label: "Usuários", permission: "user.read" },
  { href: "/permissoes", label: "Papéis e permissões", permission: "role.read" },
  { href: "/auditoria", label: "Auditoria", permission: "audit.read" },
  { href: "/configuracoes/requisitos", label: "Regras documentais", permission: "requirement.read" },
  { href: "/configuracoes/fluxos", label: "Fluxos e alçadas", permission: "approval.decide" },
  { href: "/conta", label: "Minha conta" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePageActor();
  const nav = NAV.filter((n) => !n.permission || canAnywhere(actor, n.permission) || (n.href === "/aprovacoes" && canAnywhere(actor, "document.review")))
    .map(({ href, label }) => ({ href, label }));
  return (
    <AppShell nav={nav} user={{ name: actor.name, email: actor.email }}>
      {children}
    </AppShell>
  );
}
