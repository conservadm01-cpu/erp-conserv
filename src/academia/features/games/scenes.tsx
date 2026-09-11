// =====================================================================
// Cenas dos jogos de observação (Caça ao Risco / Mestre da Qualidade).
// São ilustrações SVG em coordenadas 0–100, para que os pontos marcados
// (HotspotRound.spots, em porcentagem) caiam sempre no lugar certo em
// qualquer tamanho de tela. Novas cenas podem ser adicionadas aqui e
// referenciadas por nome nos dados do jogo.
// =====================================================================

function CosturaScene() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" role="img" aria-label="Setor de costura visto de frente">
      <rect width="100" height="100" fill="#f8f4ea" />
      {/* parede e piso */}
      <rect width="100" height="62" fill="#eef0f2" />
      <rect y="62" width="100" height="38" fill="#e0dbcf" />
      <path d="M0 62h100" stroke="#cdb98a" strokeWidth="0.6" />
      {/* janela */}
      <rect x="4" y="10" width="22" height="18" rx="1" fill="#cfe0ea" stroke="#9fb3c0" strokeWidth="0.6" />
      <path d="M15 10v18M4 19h22" stroke="#9fb3c0" strokeWidth="0.5" />
      {/* quadro de avisos */}
      <rect x="64" y="8" width="26" height="16" rx="1" fill="#fffdf7" stroke="#cdb98a" strokeWidth="0.6" />
      <path d="M67 12h14M67 15h18M67 18h10" stroke="#a3937a" strokeWidth="0.7" />
      {/* luminária */}
      <path d="M70 18v6" stroke="#6b5d49" strokeWidth="0.6" />
      <path d="M66 24h12l-2 4H68z" fill="#e0a33e" />
      {/* bancada 1 com máquina (proteção removida) */}
      <rect x="40" y="44" width="24" height="4" rx="0.8" fill="#b79c74" />
      <rect x="42" y="48" width="2" height="14" fill="#8a7250" />
      <rect x="60" y="48" width="2" height="14" fill="#8a7250" />
      <path d="M46 34h14v10H46z" fill="#2f4a63" />
      <path d="M48 30h9v4h-9z" fill="#27405a" />
      <circle cx="57" cy="32" r="1.6" fill="#cdb98a" />
      <path d="M50 40v4" stroke="#c0392b" strokeWidth="0.9" />
      {/* bancada 2 organizada */}
      <rect x="18" y="44" width="22" height="4" rx="0.8" fill="#b79c74" />
      <rect x="20" y="48" width="2" height="14" fill="#8a7250" />
      <rect x="36" y="48" width="2" height="14" fill="#8a7250" />
      <rect x="22" y="38" width="8" height="6" rx="0.6" fill="#3f7d63" />
      <rect x="32" y="40" width="6" height="4" rx="0.6" fill="#cdb98a" />
      {/* caixa no corredor */}
      <rect x="8" y="68" width="16" height="12" rx="0.8" fill="#c2703d" />
      <path d="M8 72h16" stroke="#a85c2d" strokeWidth="0.8" />
      <rect x="10" y="80" width="14" height="9" rx="0.8" fill="#b06433" />
      {/* retalhos no piso */}
      <path d="M40 82l5-3 4 3-3 4z" fill="#8fc0aa" />
      <path d="M47 86l6-2 2 3-5 3z" fill="#ddcda6" />
      <path d="M52 80l5 1v3l-4 1z" fill="#e8a49c" />
      {/* cabo elétrico solto */}
      <path d="M66 78c6 4 14-2 22 2" stroke="#2a2015" strokeWidth="1.1" fill="none" />
      <rect x="86" y="74" width="6" height="5" rx="0.6" fill="#6b5d49" />
      {/* saída de emergência */}
      <rect x="90" y="30" width="9" height="32" fill="#d8d2c4" stroke="#a3937a" strokeWidth="0.5" />
      <rect x="91" y="33" width="7" height="4" rx="0.5" fill="#3f7d63" />
    </svg>
  );
}

function CorteScene() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" role="img" aria-label="Mesa de corte em operação">
      <rect width="100" height="100" fill="#f8f4ea" />
      <rect width="100" height="58" fill="#eef0f2" />
      <rect y="58" width="100" height="42" fill="#e0dbcf" />
      {/* prateleira com rolos */}
      <rect x="4" y="12" width="30" height="4" fill="#b79c74" />
      <circle cx="10" cy="9" r="3" fill="#2f4a63" />
      <circle cx="18" cy="9" r="3" fill="#c2703d" />
      <circle cx="26" cy="9" r="3" fill="#3f7d63" />
      {/* mesa de corte */}
      <rect x="14" y="38" width="72" height="6" rx="1" fill="#b79c74" />
      <rect x="18" y="44" width="3" height="16" fill="#8a7250" />
      <rect x="79" y="44" width="3" height="16" fill="#8a7250" />
      {/* enfesto (camadas) */}
      <rect x="20" y="32" width="60" height="2" fill="#cfe0ea" />
      <rect x="20" y="34" width="60" height="2" fill="#bcd4e2" />
      <rect x="20" y="36" width="60" height="2" fill="#a9c7da" />
      {/* risco grampeado */}
      <path d="M24 32h24v4H24z" fill="none" stroke="#2f4a63" strokeWidth="0.5" strokeDasharray="1.5 1" />
      <circle cx="26" cy="32" r="0.7" fill="#6b5d49" />
      <circle cx="46" cy="32" r="0.7" fill="#6b5d49" />
      {/* máquina de corte com proteção amarrada */}
      <rect x="45" y="22" width="8" height="12" rx="1" fill="#2f4a63" />
      <path d="M49 34v4" stroke="#c0392b" strokeWidth="1.2" />
      <path d="M45 28h8" stroke="#e0a33e" strokeWidth="1" />
      <path d="M44 24c-2 2-2 6 0 8" stroke="#c0392b" strokeWidth="0.8" fill="none" strokeDasharray="1 1" />
      {/* mão de apoio sem luva */}
      <path d="M60 38c3-2 6-1 8 1l-3 3-6-1z" fill="#e8c9a6" />
      <path d="M62 44c2 1 5 1 7 0" stroke="#d8a882" strokeWidth="0.8" fill="none" />
      {/* sobras no chão */}
      <path d="M16 78l9-4 6 5-5 6z" fill="#bcd4e2" />
      <path d="M26 84l8-3 3 4-6 4z" fill="#ddcda6" />
      <path d="M20 88l7 1-1 4-6-1z" fill="#a9c7da" />
      {/* pacotes identificados */}
      <rect x="66" y="70" width="14" height="10" rx="0.8" fill="#cdb98a" />
      <rect x="68" y="72" width="10" height="3" fill="#fffdf7" />
      <rect x="82" y="74" width="12" height="9" rx="0.8" fill="#b79c74" />
      <rect x="84" y="76" width="8" height="2.5" fill="#fffdf7" />
    </svg>
  );
}

function CamisetaScene() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" role="img" aria-label="Camiseta na mesa de revisão">
      <rect width="100" height="100" fill="#f4efe2" />
      <rect x="6" y="6" width="88" height="88" rx="2" fill="#fffdf7" stroke="#cdb98a" strokeWidth="0.6" />
      {/* camiseta */}
      <path
        d="M34 16l-12 6 4 12 6-2v44h36V32l6 2 4-12-12-6-6 4h-20z"
        fill="#dfe7ec"
        stroke="#9fb3c0"
        strokeWidth="0.8"
      />
      {/* gola (com barriga) */}
      <path d="M40 16c3 6 17 6 20 0" fill="none" stroke="#2f4a63" strokeWidth="1.4" />
      <path d="M41 18c3 4 15 4 18 0" fill="none" stroke="#9fb3c0" strokeWidth="0.6" />
      {/* costura de ombro com ponto pulando */}
      <path d="M28 24h12" stroke="#2f4a63" strokeWidth="0.8" strokeDasharray="2 2" />
      <path d="M60 24h12" stroke="#2f4a63" strokeWidth="0.8" />
      {/* lateral */}
      <path d="M32 44v32M68 44v32" stroke="#9fb3c0" strokeWidth="0.6" />
      {/* barra ondulada */}
      <path d="M32 74c4 2 8-2 12 0s8 2 12 0 8-2 12 0" fill="none" stroke="#2f4a63" strokeWidth="1.2" />
      {/* etiqueta */}
      <rect x="47" y="20" width="6" height="4" rx="0.5" fill="#fffdf7" stroke="#a3937a" strokeWidth="0.4" />
      {/* fio solto */}
      <path d="M70 52c4 1 6 4 5 7" stroke="#c2703d" strokeWidth="0.8" fill="none" />
      {/* sombra de tonalidade diferente */}
      <path d="M40 44h20v18H40z" fill="#cfd8de" opacity="0.75" />
      {/* fita métrica */}
      <path d="M10 88c16-6 40-6 58 0" stroke="#e0a33e" strokeWidth="2" fill="none" />
    </svg>
  );
}

export function GameScene({ name }: { name: string }) {
  switch (name) {
    case "corte":
      return <CorteScene />;
    case "camiseta":
      return <CamisetaScene />;
    case "costura":
    default:
      return <CosturaScene />;
  }
}

export const SCENE_NAMES = ["costura", "corte", "camiseta"];
