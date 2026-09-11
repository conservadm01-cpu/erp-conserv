import {
  Activity, AlertTriangle, Archive, ArrowLeft, ArrowRight, Award, BarChart3, BookOpen, Boxes, Check,
  CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Circle, ClipboardList, Clock, Compass, Copy, Cpu,
  Download, Eye, FileText, Filter, Flag, Gamepad2, GitMerge, GraduationCap, Hammer, Heart, HelpCircle,
  Home, Image, Info, Layers, Leaf, Lightbulb, ListOrdered, Lock, LogOut, Menu, Minus, MoveDiagonal,
  PackageIcon, Palette, PenTool, Play, Plus, Printer, RefreshCw, RotateCcw, Ruler, Save, Scissors,
  ScrollText, Search, Settings, Shapes, Shield, ShieldCheck, Siren, Smile, Sparkles, Star, Target, Timer,
  TrendingUp, Trash2, Trophy, Underline, Unlock, Upload, User, Users, Wrench, X, Zap,
} from "lucide-react";

// Mapa de ícones usados pela aplicação. Ícones vêm por NOME nos dados
// (cursos, trilhas, badges, jogos), então o administrador escolhe o
// ícone de um conteúdo novo sem mexer em código.
const ICONS = {
  activity: Activity, alert: AlertTriangle, archive: Archive, "arrow-left": ArrowLeft, "arrow-right": ArrowRight,
  award: Award, chart: BarChart3, "book-open": BookOpen, boxes: Boxes, check: Check, "check-circle": CheckCircle2,
  "chevron-down": ChevronDown, "chevron-left": ChevronLeft, "chevron-right": ChevronRight, circle: Circle,
  clipboard: ClipboardList, clock: Clock, compass: Compass, copy: Copy, cpu: Cpu, download: Download, eye: Eye,
  file: FileText, filter: Filter, flag: Flag, "gamepad-2": Gamepad2, "git-merge": GitMerge,
  "graduation-cap": GraduationCap, hammer: Hammer, heart: Heart, help: HelpCircle, home: Home, image: Image,
  info: Info, layers: Layers, leaf: Leaf, lightbulb: Lightbulb, "list-ordered": ListOrdered, lock: Lock,
  logout: LogOut, menu: Menu, minus: Minus, "move-diagonal": MoveDiagonal, package: PackageIcon,
  palette: Palette, "pen-tool": PenTool, play: Play, plus: Plus, printer: Printer, refresh: RefreshCw,
  rotate: RotateCcw, ruler: Ruler, save: Save, scissors: Scissors, scroll: ScrollText, search: Search,
  settings: Settings, shapes: Shapes, shield: Shield, "shield-check": ShieldCheck, siren: Siren, smile: Smile,
  sparkles: Sparkles, star: Star, target: Target, timer: Timer, "trending-up": TrendingUp, trash: Trash2,
  trophy: Trophy, underline: Underline, unlock: Unlock, upload: Upload, user: User, users: Users, wrench: Wrench, x: X,
  zap: Zap,
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 18, className, strokeWidth = 2 }: { name: string; size?: number; className?: string; strokeWidth?: number }) {
  const Component = (ICONS as Record<string, typeof Activity>)[name] ?? Shapes;
  return <Component size={size} className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
}

export const ICON_NAMES = Object.keys(ICONS) as IconName[];
