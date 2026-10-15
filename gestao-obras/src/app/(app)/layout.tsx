import { requirePageActor } from "@/server/auth/page-context";
import { canAnywhere } from "@/server/authz/authorize";
import type { PermissionCode } from "@/server/authz/catalog";
import { AppShell, type NavItem } from "@/components/layout/AppShell";
import { unreadCount } from "@/server/services/notification.service";

export const dynamic = "force-dynamic";

const NAV: (NavItem & { permission?: PermissionCode; alt?: PermissionCode })[] = [
  { group: "", href: "/", label: "Painel", permission: "dashboard.view" },
  { group: "Obras", href: "/obras", label: "Obras", permission: "work.read" },
  { group: "Obras", href: "/documentos", label: "Documentos", permission: "document.read" },
  { group: "Obras", href: "/aprovacoes", label: "Aprovações", permission: "approval.decide", alt: "document.review" },
  { group: "Obras", href: "/orcamentos", label: "Orçamentos", permission: "budget.read" },
  { group: "Obras", href: "/relatorios", label: "Relatórios", permission: "report.generate" },
  { group: "Pessoas e empresas", href: "/pessoas", label: "Pessoas", permission: "person.read" },
  { group: "Pessoas e empresas", href: "/pessoas?categoria=VOLUNTARIO", label: "Voluntários", permission: "person.read" },
  { group: "Pessoas e empresas", href: "/pessoas?categoria=PROFISSIONAL", label: "Profissionais", permission: "person.read" },
  { group: "Pessoas e empresas", href: "/empresas", label: "Empresas", permission: "company.read" },
  { group: "Segurança", href: "/seguranca/inspecoes", label: "Inspeções", permission: "safety.read" },
  { group: "Segurança", href: "/seguranca/acoes", label: "Ações corretivas", permission: "safety.read" },
  { group: "Segurança", href: "/epis", label: "EPIs", permission: "epi.read" },
  { group: "Segurança", href: "/equipamentos", label: "Equipamentos", permission: "equipment.read" },
  { group: "Administração", href: "/organizacao", label: "Estrutura organizacional", permission: "org.read" },
  { group: "Administração", href: "/usuarios", label: "Usuários", permission: "user.read" },
  { group: "Administração", href: "/permissoes", label: "Papéis e permissões", permission: "role.read" },
  { group: "Administração", href: "/auditoria", label: "Auditoria", permission: "audit.read" },
  { group: "Administração", href: "/privacidade", label: "Privacidade (titulares)", permission: "privacy.manage" },
  { group: "Configurações", href: "/configuracoes/requisitos", label: "Regras documentais", permission: "requirement.read" },
  { group: "Configurações", href: "/configuracoes/fluxos", label: "Fluxos e alçadas", permission: "approval.decide" },
  { group: "Configurações", href: "/configuracoes/seguranca", label: "Segurança", permission: "safety.read" },
  { group: "Configurações", href: "/configuracoes/parametros", label: "Parâmetros", permission: "settings.manage" },
  { group: "Conta", href: "/notificacoes", label: "Notificações" },
  { group: "Conta", href: "/conta", label: "Minha conta" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePageActor();
  const nav = NAV.filter((n) => !n.permission || canAnywhere(actor, n.permission) || (n.alt && canAnywhere(actor, n.alt))).map(({ href, label, group }) => ({ href, label, group }));
  const unread = await unreadCount(actor.userId);
  return (
    <AppShell nav={nav} user={{ name: actor.name, email: actor.email }} unread={unread}>
      {children}
    </AppShell>
  );
}
