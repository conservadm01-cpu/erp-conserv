import type { Curiosity, ID } from "../../core/types";
import { ref } from "./contentIndex";

// =====================================================================
// BANCO DE CURIOSIDADES — DID_YOU_KNOW (seção 17)
// Cada curiosidade tem título, texto, categoria, competências e fonte.
// =====================================================================

interface CSpec {
  n: number;
  title: string;
  text: string;
  category: string;
  comps: ID[];
  src: [string, number];
}

const SPECS: CSpec[] = [
  { n: 1, title: "Uma volta no diferencial muda a malha", text: "Você sabia que uma pequena alteração no diferencial pode modificar o comportamento da malha? Por isso o ajuste é testado em retalho do mesmo tecido antes de começar o lote.", category: "costura", comps: ["CMP-REGULAGEM", "CMP-OVERLOQUE"], src: ["CNT-000001", 3] },
  { n: 2, title: "A agulha escolhe o resultado", text: "Você sabia que a escolha da agulha pode influenciar diretamente o resultado da costura? Ponta errada em malha abre furinhos que só aparecem depois da primeira lavagem.", category: "costura", comps: ["CMP-AGULHA-LINHA"], src: ["CNT-000002", 1] },
  { n: 3, title: "O desperdício nasce antes do corte", text: "Você sabia que o desperdício de tecido começa muitas vezes antes do corte? Encaixe mal resolvido e largura não conferida custam metros no fim do mês.", category: "corte", comps: ["CMP-APROVEITAMENTO"], src: ["CNT-000004", 1] },
  { n: 4, title: "Bancada organizada cansa menos", text: "Você sabia que uma bancada organizada reduz movimentos desnecessários? Menos movimento significa menos cansaço no fim do turno e menos defeito.", category: "organizacao", comps: ["CMP-5S", "CMP-ERGONOMIA"], src: ["CNT-000006", 2] },
  { n: 5, title: "Fiapo também causa defeito", text: "Você sabia que fiapo acumulado no transportador e no ponto de laçada causa ponto irregular e pode travar mecanismo? Limpar a máquina é manutenção, não faxina.", category: "manutencao", comps: ["CMP-MANUTENCAO", "CMP-5S"], src: ["CNT-000006", 3] },
  { n: 6, title: "2,5 a 3,0 mm é o nosso padrão", text: "Você sabia que o comprimento de ponto padrão da ConServ para malha de algodão fica entre 2,5 mm e 3,0 mm? Fora dessa faixa, a resistência ou o tecido sofrem.", category: "costura", comps: ["CMP-REGULAGEM"], src: ["CNT-000001", 2] },
  { n: 7, title: "A peça mais barata causa o defeito mais caro", text: "Você sabia que a agulha é a peça mais barata da máquina e a que causa os defeitos mais caros? Trocar a agulha é a primeira verificação, não a última.", category: "costura", comps: ["CMP-AGULHA-LINHA"], src: ["CNT-000002", 0] },
  { n: 8, title: "Quase acidente é informação de graça", text: "Você sabia que o quase acidente é a informação mais barata que existe em segurança? Ele mostra uma falha real sem ninguém se machucar.", category: "seguranca", comps: ["CMP-NR1", "CMP-PERIGO-RISCO"], src: ["CNT-000003", 7] },
  { n: 9, title: "EPI é a última barreira", text: "Você sabia que o EPI é a última das medidas de prevenção? Antes dele vêm eliminar o perigo, reduzir na fonte e mudar a organização do trabalho.", category: "seguranca", comps: ["CMP-NR1"], src: ["CNT-000003", 5] },
  { n: 10, title: "GRO é processo, PGR é registro", text: "Você sabia que o GRO é o processo contínuo de gerenciar riscos e o PGR é a forma de documentá-lo? Confundir os dois é o erro mais comum nesse assunto.", category: "seguranca", comps: ["CMP-NR1"], src: ["CNT-000003", 2] },
  { n: 11, title: "Tonalidade denuncia lote misturado", text: "Você sabia que lotes diferentes da mesma cor podem ter tonalidade levemente distinta? É por isso que o pacote identificado viaja com as partes até a embalagem.", category: "qualidade", comps: ["CMP-QUALIDADE", "CMP-CORTE-MAQUINA"], src: ["CNT-000004", 5] },
  { n: 12, title: "A malha precisa descansar", text: "Você sabia que malha enrolada sob tensão encolhe depois de aberta na mesa? Deixar o tecido relaxar antes do enfesto evita peça fora de medida.", category: "corte", comps: ["CMP-ENFESTO"], src: ["CNT-000004", 4] },
  { n: 13, title: "A seta do molde não é enfeite", text: "Você sabia que ignorar o sentido do fio para ganhar aproveitamento faz a peça torcer na lavagem? O ganho de centímetros custa a peça inteira.", category: "corte", comps: ["CMP-RISCO-ENCAIXE"], src: ["CNT-000004", 2] },
  { n: 14, title: "A primeira peça vale noventa e nove", text: "Você sabia que conferir a primeira peça do lote é a inspeção mais eficiente que existe? Ela custa dois minutos e evita refazer o lote inteiro.", category: "qualidade", comps: ["CMP-QUALIDADE", "CMP-RETRABALHO"], src: ["CNT-000005", 9] },
  { n: 15, title: "Acabamento é o que o cliente vê primeiro", text: "Você sabia que fio solto e ponta de linha longa são os defeitos que o cliente percebe primeiro? Eles aparecem na peça dobrada, antes de qualquer outra coisa.", category: "qualidade", comps: ["CMP-QUALIDADE"], src: ["CNT-000005", 6] },
  { n: 16, title: "Medida fora em todo o lote não é da costura", text: "Você sabia que, quando a medida está fora em toda a amostra, o problema normalmente está antes da costura? Enfesto, corte ou molde entram na investigação.", category: "qualidade", comps: ["CMP-DEFEITOS"], src: ["CNT-000005", 3] },
  { n: 17, title: "Ombro elevado é sinal de posto mal ajustado", text: "Você sabia que trabalhar com os ombros elevados indica mesa alta ou cadeira baixa? Horas nessa posição viram dor cervical e tendinite.", category: "ergonomia", comps: ["CMP-ERGONOMIA"], src: ["CNT-000009", 2] },
  { n: 18, title: "Pausas curtas valem mais que uma longa", text: "Você sabia que pausas curtas distribuídas ao longo do turno reduzem mais a fadiga do que uma pausa longa no fim? O corpo recupera antes de acumular.", category: "ergonomia", comps: ["CMP-ERGONOMIA"], src: ["CNT-000009", 5] },
  { n: 19, title: "Luz insuficiente também gera defeito", text: "Você sabia que costurar tecido escuro com pouca luz aumenta o esforço visual, a inclinação do pescoço e o número de defeitos que passam batido?", category: "ergonomia", comps: ["CMP-ERGONOMIA", "CMP-QUALIDADE"], src: ["CNT-000009", 4] },
  { n: 20, title: "Curar não é esquentar o ar", text: "Você sabia que na estamparia o que precisa atingir a temperatura é a película de tinta, e não o ar da estufa? Tinta mal curada sai na lavagem, já no cliente.", category: "estamparia", comps: ["CMP-SILK-IMPRESSAO"], src: ["CNT-000007", 6] },
  { n: 21, title: "Gordura de mão estraga a tela", text: "Você sabia que a gordura da mão é a causa mais comum de falha de adesão da emulsão na tela? Desengordurar antes de emulsionar economiza regravação.", category: "estamparia", comps: ["CMP-SILK-TELA"], src: ["CNT-000007", 1] },
  { n: 22, title: "Duas passadas leves cobrem melhor", text: "Você sabia que duas passadas leves de rodo cobrem melhor que uma passada forte? Pressão excessiva espalha tinta além do desenho e mancha a peça.", category: "estamparia", comps: ["CMP-SILK-IMPRESSAO"], src: ["CNT-000007", 5] },
  { n: 23, title: "Caixa X de Y evita devolução", text: "Você sabia que identificar a caixa no formato “caixa X de Y” permite ao cliente conferir o pedido? Sem isso, a divergência vira devolução do pedido inteiro.", category: "embalagem", comps: ["CMP-EMBALAGEM"], src: ["CNT-000008", 4] },
  { n: 24, title: "O lote é a memória da peça", text: "Você sabia que é pelo lote que descobrimos onde e quando uma peça foi produzida? Apagar essa informação na embalagem quebra a rastreabilidade.", category: "embalagem", comps: ["CMP-EMBALAGEM"], src: ["CNT-000008", 5] },
  { n: 25, title: "Contar é mais rápido que recontar", text: "Você sabia que a contagem por estimativa é a origem mais comum de divergência na conferência do cliente? Contar uma vez com atenção poupa conferir tudo de novo.", category: "embalagem", comps: ["CMP-EMBALAGEM"], src: ["CNT-000008", 3] },
  { n: 26, title: "Ombro antes da gola", text: "Você sabia que pregar a gola com o ombro aberto desalinha o centro e produz decote assimétrico? A sequência operacional existe por um motivo técnico.", category: "costura", comps: ["CMP-SEQ-OPERACIONAL"], src: ["CNT-000011", 2] },
  { n: 27, title: "Manga aberta, costura fácil", text: "Você sabia que pregar a manga antes de fechar a lateral evita costurar dentro de um tubo estreito? Isso reduz torção e peça presa.", category: "costura", comps: ["CMP-SEQ-OPERACIONAL"], src: ["CNT-000011", 3] },
  { n: 28, title: "Ritmo demais produz menos", text: "Você sabia que ritmo excessivo no começo do dia aumenta defeito e derruba a produção no fim? O total do dia fica menor, não maior.", category: "produtividade", comps: ["CMP-PRODUTIVIDADE"], src: ["CNT-000012", 4] },
  { n: 29, title: "Qualidade devolve tempo", text: "Você sabia que reduzir defeito quase sempre aumenta a produção? O tempo do retrabalho volta para a linha — é tempo gasto duas vezes na mesma peça.", category: "produtividade", comps: ["CMP-PRODUTIVIDADE", "CMP-QUALIDADE"], src: ["CNT-000012", 5] },
  { n: 30, title: "Padrão só na cabeça desaparece", text: "Você sabia que um padrão que existe apenas na memória de uma pessoa desaparece no dia em que ela falta? Padronizar é deixar o combinado visível.", category: "organizacao", comps: ["CMP-5S", "CMP-COMUNICACAO"], src: ["CNT-000006", 4] },
  { n: 31, title: "Nenhuma etapa aparece — o conjunto aparece", text: "Você sabia que nenhuma etapa da fábrica aparece sozinha na peça pronta? O que o cliente vê é a soma de decisões pequenas tomadas por muita gente.", category: "cultura", comps: ["CMP-CULTURA"], src: ["CNT-000010", 6] },
  { n: 32, title: "Problema escondido custa mais", text: "Você sabia que problema escondido sempre custa mais caro que problema falado? Comunicar cedo é parte do ofício, não reclamação.", category: "cultura", comps: ["CMP-COMUNICACAO", "CMP-CULTURA"], src: ["CNT-000010", 7] },
];

export const SEED_CURIOSITIES: Curiosity[] = SPECS.map((s) => ({
  id: `CUR-${String(s.n).padStart(6, "0")}`,
  title: s.title,
  text: s.text,
  category: s.category,
  competencies: s.comps,
  sourceRef: ref(s.src[0], s.src[1]),
  xp: 5,
  status: "published",
  createdAt: "2026-03-02T12:00:00.000Z",
}));
