import {
  BarChart3, BedDouble, BookHeart, BookOpen, CalendarDays, Car, Compass, Film, GalleryVerticalEnd, LayoutDashboard,
  Luggage, Search, Settings, Ticket, Wallet, Route,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV: NavItem[] = [
  { href: "/", label: "Painel", icon: LayoutDashboard },
  { href: "/viagens", label: "Minhas viagens", icon: Luggage },
  { href: "/pesquisar", label: "Pesquisar", icon: Search },
  { href: "/hospedagem", label: "Hospedagem", icon: BedDouble },
  { href: "/veiculos", label: "Veículos", icon: Car },
  { href: "/passeios", label: "Passeios", icon: Compass },
  { href: "/orcamento", label: "Orçamento", icon: Wallet },
  { href: "/reservas", label: "Reservas", icon: Ticket },
  { href: "/roteiro", label: "Roteiro", icon: CalendarDays },
  { href: "/diario", label: "Diário da viagem", icon: BookOpen },
  { href: "/linha-do-tempo", label: "Linha do tempo", icon: Route },
  { href: "/midia", label: "Fotos e vídeos", icon: GalleryVerticalEnd },
  { href: "/midia/video", label: "Editor de vídeo", icon: Film },
  { href: "/book", label: "Book da viagem", icon: BookHeart },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export const MOBILE_NAV = ["/", "/orcamento", "/roteiro", "/midia", "/diario"];

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/midia") return pathname === "/midia" || pathname.startsWith("/midia/foto");
  return pathname === href || pathname.startsWith(`${href}/`);
}
