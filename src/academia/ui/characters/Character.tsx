import type { CharacterId } from "../../core/types";
import { cn } from "../../core/cn";

// =====================================================================
// PERSONAGENS (seção 2) — desenhados em SVG, sem depender de imagem
// externa (funciona offline e não pesa no carregamento).
//   MESTRE CONSERV — profissional experiente da confecção
//   DONA SEGURANÇA — especialista em NR-1, riscos e prevenção
// =====================================================================

export const CHARACTERS: Record<Exclude<CharacterId, "nenhum">, { name: string; role: string; accent: string }> = {
  mestre: {
    name: "Mestre ConServ",
    role: "Costura, corte, máquinas, regulagem e qualidade",
    accent: "navy",
  },
  seguranca: {
    name: "Dona Segurança",
    role: "NR-1, riscos, ergonomia e prevenção",
    accent: "copper",
  },
};

function MestreAvatar({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Mestre ConServ">
      <circle cx="32" cy="32" r="32" fill="#1f354c" />
      <circle cx="32" cy="27" r="13" fill="#e8c9a6" />
      {/* boina */}
      <path d="M17 22c2-8 10-12 15-12s13 4 15 12c-8-3-22-3-30 0z" fill="#2f4a63" />
      <path d="M16 22h32c0 2-1 3-3 3H19c-2 0-3-1-3-3z" fill="#27405a" />
      {/* óculos */}
      <circle cx="26" cy="27" r="4.2" fill="none" stroke="#2a2015" strokeWidth="1.4" />
      <circle cx="38" cy="27" r="4.2" fill="none" stroke="#2a2015" strokeWidth="1.4" />
      <path d="M30.2 27h3.6M21.8 26l-2.5-1M42.2 26l2.5-1" stroke="#2a2015" strokeWidth="1.4" />
      {/* bigode e sorriso */}
      <path d="M27 34h10" stroke="#6b5d49" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M28.5 37.5c1.6 1.4 5.4 1.4 7 0" stroke="#8a6a4f" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* ombros e camisa */}
      <path d="M12 64c1-11 9-17 20-17s19 6 20 17z" fill="#f4efe2" />
      {/* fita métrica */}
      <path d="M24 47c-4 6-5 11-5 17M40 47c4 6 5 11 5 17" stroke="#c2703d" strokeWidth="3.4" strokeLinecap="round" fill="none" />
      <circle cx="19.5" cy="62" r="1" fill="#f4efe2" />
      <circle cx="44.5" cy="62" r="1" fill="#f4efe2" />
    </svg>
  );
}

function SegurancaAvatar({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Dona Segurança">
      <circle cx="32" cy="32" r="32" fill="#1c2b39" />
      <circle cx="32" cy="28" r="12.5" fill="#d8a882" />
      {/* cabelo */}
      <path d="M19 28c0-8 6-13 13-13s13 5 13 13c0-4-4-6-13-6s-13 2-13 6z" fill="#3a2b22" />
      <path d="M19.5 28c-1 6 0 10 1 12-3-2-4-8-1-12zM44.5 28c1 6 0 10-1 12 3-2 4-8 1-12z" fill="#3a2b22" />
      {/* capacete */}
      <path d="M17 22c1-8 7-13 15-13s14 5 15 13z" fill="#e0a33e" />
      <path d="M15 22h34c0 2-1.5 3.5-3.5 3.5h-27C16.5 25.5 15 24 15 22z" fill="#c2703d" />
      <path d="M32 9v13" stroke="#c2703d" strokeWidth="1.6" />
      {/* olhos e sorriso */}
      <circle cx="27" cy="28" r="1.8" fill="#2a2015" />
      <circle cx="37" cy="28" r="1.8" fill="#2a2015" />
      <path d="M28.5 34.5c1.8 1.8 5.2 1.8 7 0" stroke="#8a4f3f" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      {/* colete refletivo */}
      <path d="M12 64c1-11 9-17 20-17s19 6 20 17z" fill="#e0a33e" />
      <path d="M26 48l-3 16h4l2-14zM38 48l3 16h-4l-2-14z" fill="#f4efe2" />
      <path d="M20 56h24" stroke="#f4efe2" strokeWidth="2.6" />
    </svg>
  );
}

export function CharacterAvatar({ character, size = 48 }: { character: CharacterId; size?: number }) {
  if (character === "seguranca") return <SegurancaAvatar size={size} />;
  if (character === "mestre") return <MestreAvatar size={size} />;
  return null;
}

/** Fala do personagem — é assim que o conteúdo "conversa" com a pessoa. */
export function CharacterSpeech({ character, children, size = 44, className, compact }: {
  character: CharacterId;
  children: React.ReactNode;
  size?: number;
  className?: string;
  compact?: boolean;
}) {
  if (character === "nenhum") return <p className={cn("text-[15px]", className)}>{children}</p>;
  const meta = CHARACTERS[character];
  const tone = character === "seguranca"
    ? "bg-copper/8 border-copper/25"
    : "bg-navy/5 border-navy/20";
  return (
    <div className={cn("flex gap-3 items-start", className)}>
      <span className="shrink-0">
        <CharacterAvatar character={character} size={size} />
      </span>
      <div className={cn("relative rounded-2xl border px-4 py-3 flex-1 min-w-0", tone)}>
        {!compact && (
          <div className="text-[11px] font-bold uppercase tracking-wide text-ink-600 mb-1">{meta.name}</div>
        )}
        <div className="text-[15px] leading-relaxed text-ink">{children}</div>
      </div>
    </div>
  );
}
