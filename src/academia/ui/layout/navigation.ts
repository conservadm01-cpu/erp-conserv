export interface NavItem {
  to: string;
  label: string;
  icon: string;
  shortLabel?: string;
  /** Exibe no menu inferior do celular. */
  mobile?: boolean;
}

/** Navegação do colaborador. */
export const MAIN_NAV: NavItem[] = [
  { to: "/", label: "Início", icon: "home", mobile: true },
  { to: "/trilhas", label: "Trilhas", icon: "compass", mobile: true },
  { to: "/jogos", label: "Jogos", icon: "gamepad-2", mobile: true },
  { to: "/posto", label: "Aprender no posto", icon: "wrench", shortLabel: "No posto", mobile: true },
  { to: "/curiosidades", label: "Curiosidades", icon: "lightbulb" },
  { to: "/competencias", label: "Minhas competências", icon: "target", shortLabel: "Competências" },
  { to: "/certificados", label: "Certificados", icon: "award" },
  { to: "/apostilas", label: "Apostilas", icon: "book-open" },
  { to: "/cultura", label: "Cultura ConServ", icon: "heart" },
  { to: "/perfil", label: "Meu perfil", icon: "user", shortLabel: "Perfil" },
];

/** Navegação do painel administrativo (seção 20). */
export const ADMIN_NAV: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: "chart" },
  { to: "/admin/colaboradores", label: "Colaboradores", icon: "users" },
  { to: "/admin/conteudos", label: "Conteúdos", icon: "file" },
  { to: "/admin/cursos", label: "Cursos", icon: "book-open" },
  { to: "/admin/apostilas", label: "Apostilas", icon: "printer" },
  { to: "/admin/quizzes", label: "Quizzes", icon: "clipboard" },
  { to: "/admin/jogos", label: "Jogos", icon: "gamepad-2" },
  { to: "/admin/competencias", label: "Competências", icon: "target" },
  { to: "/admin/certificados", label: "Certificados", icon: "award" },
  { to: "/admin/trilhas", label: "Trilhas", icon: "compass" },
  { to: "/admin/nr1", label: "NR-1", icon: "shield" },
  { to: "/admin/fontes", label: "Fontes", icon: "scroll" },
  { to: "/admin/riscos", label: "Riscos reportados", icon: "siren" },
  { to: "/admin/relatorios", label: "Relatórios", icon: "trending-up" },
  { to: "/admin/auditoria", label: "Auditoria", icon: "lock" },
  { to: "/admin/configuracoes", label: "Configurações", icon: "settings" },
];
