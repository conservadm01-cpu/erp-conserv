import type { Challenge, CharacterId, ID, QuestionDifficulty } from "../../core/types";
import { ref } from "./contentIndex";

// =====================================================================
// DESAFIOS (seção 16) — situações reais da fábrica.
// O "Desafio do Dia" do dashboard sorteia entre os marcados como
// dailyEligible, sem repetir o que a pessoa já respondeu.
// =====================================================================

interface DSpec {
  n: number;
  title: string;
  scenario: string;
  character: CharacterId;
  opts: string[];
  correct: number;
  why: string;
  category: string;
  comps: ID[];
  diff?: QuestionDifficulty;
  src: [string, number];
  xp?: number;
  daily?: boolean;
  course?: ID;
}

const SPECS: DSpec[] = [
  {
    n: 1, title: "Pontos irregulares na máquina", character: "mestre", category: "costura", diff: "facil",
    scenario: "Você encontrou uma máquina fazendo pontos irregulares, bem no meio do lote. Qual deve ser sua primeira atitude?",
    opts: [
      "Parar a costura e conferir agulha, passamento de linha e limpeza antes de seguir",
      "Aumentar a velocidade para ver se o ponto regulariza",
      "Continuar o lote e separar as peças ruins para a revisão",
      "Mexer na tensão de todos os tensores ao mesmo tempo",
    ],
    correct: 0,
    why: "Parar e verificar o básico — agulha, passamento e fiapo — resolve a maioria dos casos. Seguir produzindo com defeito conhecido multiplica o retrabalho, e mexer em tudo ao mesmo tempo desregula uma máquina que estava correta.",
    comps: ["CMP-REGULAGEM", "CMP-QUALIDADE"], src: ["CNT-000001", 7], daily: true, course: "CRS-001",
  },
  {
    n: 2, title: "O tecido está franzindo", character: "mestre", category: "costura", diff: "medio",
    scenario: "A costura da lateral está franzindo na overloque, em malha leve. Por onde você começa a investigar?",
    opts: [
      "Pela linha do looper inferior",
      "Pelo diferencial, testando em retalho do mesmo tecido",
      "Pela faca, que deve estar cega",
      "Pelo comprimento do ponto, aumentando para 4 mm",
    ],
    correct: 1,
    why: "O roteiro da casa começa pelo diferencial, sempre testando em retalho do mesmo tecido; depois vêm tensão da agulha, pressão do calcador e agulha.",
    comps: ["CMP-REGULAGEM", "CMP-OVERLOQUE"], src: ["CNT-000001", 6], daily: true, course: "CRS-001",
  },
  {
    n: 3, title: "Agulha quebrou no meio da peça", character: "seguranca", category: "seguranca", diff: "facil",
    scenario: "A agulha quebrou e parte dela caiu dentro da peça. O que fazer?",
    opts: [
      "Procurar o pedaço, recolher todas as partes, descartar no recipiente rígido e só então retomar",
      "Trocar a agulha e seguir, pois o pedaço se perde no resíduo",
      "Separar a peça para a revisão encontrar o pedaço",
      "Soprar a peça com ar comprimido para o pedaço sair",
    ],
    correct: 0,
    why: "Fragmento de agulha dentro da peça fere quem manuseia e pode chegar ao cliente. Todas as partes devem ser recolhidas e descartadas em recipiente rígido identificado.",
    comps: ["CMP-AGULHA-LINHA", "CMP-PERIGO-RISCO"], src: ["CNT-000002", 5], daily: true,
  },
  {
    n: 4, title: "Caixa no corredor", character: "seguranca", category: "seguranca", diff: "facil",
    scenario: "No fim do turno, três caixas de peça pronta ficaram no corredor de passagem, encostadas perto da saída de emergência. Qual é a leitura correta?",
    opts: [
      "É desorganização, resolve amanhã de manhã",
      "É risco de queda e de atraso na evacuação: deve ser retirado agora e reportado",
      "Não há problema, pois o corredor é largo",
      "Basta sinalizar com fita no chão",
    ],
    correct: 1,
    why: "Corredor e saída de emergência obstruídos deixam de ser desorganização e passam a ser risco: queda e atraso na evacuação. Retirar imediatamente e registrar é o correto.",
    comps: ["CMP-PERIGO-RISCO", "CMP-5S"], src: ["CNT-000006", 7], daily: true, course: "CRS-005",
  },
  {
    n: 5, title: "Duas tonalidades na mesma peça", character: "mestre", category: "qualidade", diff: "medio",
    scenario: "Na revisão, você nota que a frente e as costas da mesma camiseta têm tonalidades ligeiramente diferentes. Qual é a ação?",
    opts: [
      "Aprovar: a diferença é pequena e o cliente não percebe",
      "Reprovar apenas essa peça e seguir a inspeção",
      "Localizar o pacote, conferir a identificação e bloquear o lote até o corte confirmar a origem",
      "Mandar para a estamparia cobrir a diferença",
    ],
    correct: 2,
    why: "Diferença de tonalidade entre partes indica mistura de lotes de tecido. É preciso localizar o pacote, conferir a identificação e bloquear o lote — provavelmente há outras peças afetadas.",
    comps: ["CMP-QUALIDADE", "CMP-DEFEITOS"], src: ["CNT-000005", 4], daily: true, course: "CRS-003",
  },
  {
    n: 6, title: "Medida fora em toda a amostra", character: "mestre", category: "qualidade", diff: "dificil",
    scenario: "Cinco peças medidas da mesma amostra estão 2 cm acima da tabela da ficha técnica. A costura está regular e bem acabada. Onde investigar?",
    opts: [
      "Na tensão da linha da costureira",
      "Antes da costura: enfesto com tensão, corte fora do traço ou molde desatualizado",
      "Na galoneira, que está com diferencial alto",
      "Na fita métrica da revisão",
    ],
    correct: 1,
    why: "Quando a medida está fora em toda a amostra e a costura está correta, a causa normalmente está antes da costura: enfesto, corte ou molde.",
    comps: ["CMP-DEFEITOS", "CMP-FICHA-TECNICA"], src: ["CNT-000005", 3], daily: true, course: "CRS-003",
  },
  {
    n: 7, title: "Proteção que incomoda", character: "seguranca", category: "seguranca", diff: "medio",
    scenario: "Um colega amarrou a proteção da lâmina da máquina de corte para enxergar melhor o traço. O que você faz?",
    opts: [
      "Nada: é a forma de trabalho dele",
      "Peço para ele tomar cuidado e sigo meu trabalho",
      "Interrompo a operação, restabeleço a proteção e comunico a liderança",
      "Faço igual, já que funciona",
    ],
    correct: 2,
    why: "Proteção de lâmina nunca é removida ou amarrada. Zelar pela segurança dos colegas é dever previsto na NR-1, e a situação precisa ser comunicada para tratar a causa (ex.: iluminação ou método).",
    comps: ["CMP-PERIGO-RISCO", "CMP-NR1"], src: ["CNT-000004", 6], daily: true, course: "CRS-004",
  },
  {
    n: 8, title: "Estampa sai na lavagem", character: "mestre", category: "estamparia", diff: "medio",
    scenario: "Um cliente relatou que a estampa de um lote desbotou e rachou após a primeira lavagem. Qual é a hipótese mais provável?",
    opts: [
      "Registro fora de posição",
      "Tinta mal curada: tempo e temperatura da película não atingidos",
      "Mesh da tela muito baixo",
      "Rodo com pressão insuficiente",
    ],
    correct: 1,
    why: "Cura insuficiente é a causa clássica de estampa que racha e desbota na lavagem. É a temperatura da película de tinta que precisa ser atingida, não a do ar da estufa.",
    comps: ["CMP-SILK-IMPRESSAO", "CMP-QUALIDADE"], src: ["CNT-000007", 6], daily: true,
  },
  {
    n: 9, title: "Dor que não passa", character: "seguranca", category: "ergonomia", diff: "facil",
    scenario: "Há duas semanas você sente formigamento na mão direita, que continua depois do turno. O que fazer?",
    opts: [
      "Esperar passar: é normal no começo de um modelo novo",
      "Trocar de máquina sem avisar ninguém",
      "Comunicar a liderança e o serviço de saúde para avaliar o posto",
      "Usar pulseira elástica e continuar",
    ],
    correct: 2,
    why: "Formigamento e dor que persiste depois do turno são sinais de alerta. Comunicar cedo permite ajustar o posto antes de virar afastamento.",
    comps: ["CMP-ERGONOMIA", "CMP-COMUNICACAO"], src: ["CNT-000009", 6], daily: true, course: "CRS-002",
  },
  {
    n: 10, title: "Pacote sem identificação", character: "mestre", category: "corte", diff: "medio",
    scenario: "Chegou na preparação um pacote de mangas sem etiqueta de identificação. Qual é a atitude correta?",
    opts: [
      "Seguir com a produção: manga é manga",
      "Não usar o pacote, comunicar o corte e esperar a identificação correta do lote",
      "Colocar uma etiqueta nova estimando o tamanho",
      "Dividir o pacote entre os postos para não parar",
    ],
    correct: 1,
    why: "Sem identificação não há rastreabilidade de lote, tamanho e cor. Usar o pacote arrisca misturar lotes — o defeito aparece só na peça pronta.",
    comps: ["CMP-CORTE-MAQUINA", "CMP-QUALIDADE"], src: ["CNT-000004", 5], daily: true, course: "CRS-004",
  },
  {
    n: 11, title: "Meta x método", character: "mestre", category: "produtividade", diff: "dificil",
    scenario: "Sua meta do dia subiu e você percebe que, correndo mais, começam a aparecer defeitos. Qual caminho resolve de verdade?",
    opts: [
      "Acelerar e deixar a revisão filtrar",
      "Olhar o método: o que é procurado, esperado ou movimentado além do necessário no posto",
      "Pedir para reduzir a meta e manter tudo igual",
      "Trabalhar sem pausa para compensar",
    ],
    correct: 1,
    why: "A maior parte do tempo perdido está em procura, espera e retrabalho, não na operação. Melhorar o método devolve tempo sem custo de qualidade; acelerar com defeito reduz a produção real.",
    comps: ["CMP-PRODUTIVIDADE", "CMP-QUALIDADE"], src: ["CNT-000012", 5], daily: true, course: "CRS-001",
  },
  {
    n: 12, title: "Quase acidente com empilhamento", character: "seguranca", category: "seguranca", diff: "facil",
    scenario: "Uma caixa caiu de uma pilha alta e passou raspando por uma colega. Ninguém se machucou. E agora?",
    opts: [
      "Recolocar a caixa e seguir: não houve lesão",
      "Registrar como quase acidente e tratar a causa do empilhamento",
      "Registrar só se a colega quiser",
      "Avisar no fim do mês na reunião",
    ],
    correct: 1,
    why: "Quase acidente deve ser comunicado como um acidente, sem busca de culpado: é a chance de corrigir a causa antes de alguém se machucar.",
    comps: ["CMP-NR1", "CMP-EMERGENCIA"], src: ["CNT-000003", 7], daily: true, course: "CRS-002",
  },
];

export const SEED_CHALLENGES: Challenge[] = SPECS.map((s) => {
  const id = `CHL-${String(s.n).padStart(6, "0")}`;
  const options = s.opts.map((text, i) => ({ id: `${id}-O${i + 1}`, text }));
  return {
    id,
    title: s.title,
    scenario: s.scenario,
    character: s.character,
    options,
    correctOptionId: options[s.correct].id,
    explanation: s.why,
    category: s.category,
    competencies: s.comps,
    difficulty: s.diff ?? "medio",
    xp: s.xp ?? 100,
    sourceRef: ref(s.src[0], s.src[1]),
    dailyEligible: s.daily ?? true,
    courseId: s.course,
    contentId: s.src[0],
    status: "published",
    createdAt: "2026-03-02T12:00:00.000Z",
  };
});
