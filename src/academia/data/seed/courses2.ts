import { buildCourse, type BuiltCourse, type CourseSpec } from "./courseBuilder";
import { ref } from "./contentIndex";
import { call, ch, h, li, ol, safety, sid, steps, t, tbl } from "./blocks";

const DISCLAIMER = "Conteúdo educativo. Consulte a legislação e os responsáveis técnicos da empresa para aplicação específica.";

// =====================================================================
// CURSO 2 — NR-1 (trilha específica de segurança, seção 6)
// =====================================================================
const nr1: CourseSpec = {
  id: "CRS-002",
  code: "NR1-BASE",
  title: "NR-1 — Segurança e Saúde no Trabalho",
  subtitle: "Perigo, risco, GRO, PGR e o seu papel nisso tudo.",
  description:
    "Formação educativa sobre a Norma Regulamentadora nº 1: conceitos fundamentais, direitos e deveres, identificação de perigos, avaliação de riscos, GRO, PGR, inventário de riscos, plano de ação, participação dos trabalhadores, comunicação, emergência, acidentes, quase acidentes, ergonomia e fatores psicossociais.",
  category: "seguranca",
  level: "basico",
  sector: "Todos",
  hours: 6,
  icon: "shield",
  accent: "copper",
  competencies: ["CMP-NR1", "CMP-PERIGO-RISCO", "CMP-EMERGENCIA", "CMP-PSICOSSOCIAL", "CMP-ERGONOMIA"],
  sourceContentIds: ["CNT-000003", "CNT-000009"],
  librarySourceIds: ["SRCLIB-MTE-NR1", "SRCLIB-MTE-NR12", "SRCLIB-MTE-NR17"],
  passScore: 80,
  classification: "Certificado de conclusão de treinamento interno (conteúdo educativo — não substitui treinamento normativo obrigatório)",
  createdAt: "2026-03-02T12:00:00.000Z",
  modules: [
    {
      title: "1. Conceitos fundamentais, direitos e deveres",
      summary: "O que é a NR-1, o que é perigo, o que é risco e o que cabe a cada um.",
      lessons: [{
        title: "Perigo não é risco — e essa diferença muda tudo",
        summary: "Os conceitos que organizam toda a segurança do trabalho.",
        durationMin: 10,
        competencies: ["CMP-NR1", "CMP-PERIGO-RISCO"],
        fromContentId: "CNT-000003",
        refs: [ref("CNT-000003", 0), ref("CNT-000003", 1), ref("CNT-000003", 6)],
        blocks: [
          ch("seguranca", "Oi! Eu sou a Dona Segurança. Minha pergunta favorita é simples: o que pode dar errado aqui?"),
          call("info", "Aviso importante", DISCLAIMER),
          t("A NR-1 estabelece as disposições gerais e o gerenciamento de riscos ocupacionais aplicáveis às demais normas de segurança e saúde no trabalho. Ela organiza o que a empresa deve fazer para conhecer, avaliar e controlar os riscos, e o que cada trabalhador deve fazer no dia a dia.", sid("CNT-000003", 0)),
          h("Perigo x Risco"),
          tbl(
            ["Conceito", "Definição", "Exemplo na fábrica"],
            [
              ["Perigo", "Fonte com potencial de causar lesão ou agravo à saúde", "Faca de corte sem proteção"],
              ["Risco", "Combinação entre probabilidade e gravidade", "Chance de corte × gravidade do corte"],
            ],
            undefined,
            sid("CNT-000003", 1),
          ),
          t("Primeiro se identifica o perigo, depois se avalia o risco.", sid("CNT-000003", 1)),
          h("Direitos e deveres andam juntos"),
          li([
            "Direito: informação clara sobre os riscos do seu trabalho.",
            "Direito: medidas de prevenção e treinamento.",
            "Direito: participar do processo por meio dos seus representantes.",
            "Dever: cumprir as orientações de segurança.",
            "Dever: usar corretamente o EPI fornecido.",
            "Dever: zelar pela sua segurança e pela dos colegas.",
            "Dever: comunicar situações de risco ao superior imediato.",
          ], sid("CNT-000003", 6)),
          ch("seguranca", "Repare: comunicar risco é dever seu e direito seu. Quem avisa protege a equipe inteira."),
        ],
      }],
    },
    {
      title: "2. Identificação de perigos e avaliação de riscos",
      summary: "Onde os perigos se esconde na confecção e como a prevenção é priorizada.",
      lessons: [{
        title: "Caçando perigos na confecção",
        summary: "Os perigos típicos do nosso processo e a ordem de prioridade das medidas.",
        durationMin: 10,
        competencies: ["CMP-PERIGO-RISCO", "CMP-NR1"],
        fromContentId: "CNT-000003",
        refs: [ref("CNT-000003", 4), ref("CNT-000003", 5)],
        blocks: [
          ch("seguranca", "Vou te mostrar onde eu olho primeiro quando entro num setor."),
          t("A identificação de perigos olha para o trabalho como ele realmente acontece.", sid("CNT-000003", 4)),
          h("Perigos mais comuns na confecção"),
          li([
            "Máquinas com partes móveis, agulhas e facas.",
            "Movimentação de fardos e caixas.",
            "Ruído e calor em prensas e estufas.",
            "Produtos químicos de estamparia e limpeza.",
            "Eletricidade, piso escorregadio e iluminação insuficiente.",
            "Postura mantida e repetitividade de movimento.",
          ], sid("CNT-000003", 4)),
          h("Ordem de prioridade das medidas"),
          ol([
            "Eliminar o perigo.",
            "Reduzir na fonte.",
            "Reduzir pela organização do trabalho.",
            "Medidas administrativas ou de sinalização.",
            "Equipamento de proteção individual (EPI).",
          ], sid("CNT-000003", 5)),
          call("atencao", "O EPI é a última barreira", "EPI não substitui as medidas anteriores. Se a solução proposta começa e termina no EPI, falta analisar o processo.", sid("CNT-000003", 5)),
        ],
      }],
    },
    {
      title: "3. GRO, PGR, inventário e plano de ação",
      summary: "Como o gerenciamento de riscos fica documentado e vivo.",
      lessons: [{
        title: "GRO e PGR sem decoreba",
        summary: "O ciclo do gerenciamento e os dois documentos que o sustentam.",
        durationMin: 10,
        competencies: ["CMP-NR1"],
        fromContentId: "CNT-000003",
        refs: [ref("CNT-000003", 2), ref("CNT-000003", 3)],
        blocks: [
          ch("seguranca", "Muita gente confunde: GRO é o processo; PGR é onde ele fica registrado."),
          t("O GRO, Gerenciamento de Riscos Ocupacionais, é o processo contínuo de identificar perigos, avaliar riscos, definir medidas de prevenção, acompanhar a eficácia e revisar quando algo muda. Não é um documento: é um ciclo que não termina.", sid("CNT-000003", 2)),
          t("O PGR é a forma como esse gerenciamento fica documentado. Ele se sustenta em dois documentos: o inventário de riscos e o plano de ação.", sid("CNT-000003", 3)),
          tbl(
            ["Documento", "O que registra"],
            [
              ["Inventário de riscos", "Perigos identificados, riscos avaliados e quem está exposto"],
              ["Plano de ação", "O que será feito, por quem, até quando e como verificar se funcionou"],
            ],
            undefined,
            sid("CNT-000003", 3),
          ),
          call("info", "Onde você entra", "Quando você reporta um risco pelo botão “Eu vi um risco”, essa informação alimenta exatamente esse ciclo."),
          call("info", "Aviso", DISCLAIMER),
        ],
      }],
    },
    {
      title: "4. Emergência, quase acidente e fatores psicossociais",
      summary: "Conduta em emergência, valor do quase acidente e saúde na organização do trabalho.",
      lessons: [{
        title: "O aviso que evita o acidente",
        summary: "Quase acidente, emergência e fatores psicossociais do trabalho.",
        durationMin: 11,
        competencies: ["CMP-EMERGENCIA", "CMP-PSICOSSOCIAL"],
        fromContentId: "CNT-000003",
        refs: [ref("CNT-000003", 7), ref("CNT-000003", 8), ref("CNT-000003", 9)],
        blocks: [
          ch("seguranca", "Quase acidente é presente embrulhado: mostra a falha sem ninguém se machucar."),
          t("O quase acidente é o evento que poderia ter causado lesão, mas não causou. É a informação mais barata que existe em segurança. Na ConServ, quase acidente deve ser comunicado do mesmo jeito que o acidente, sem busca de culpado.", sid("CNT-000003", 7)),
          h("Fatores de risco psicossociais relacionados ao trabalho"),
          t("Tratam de como a organização do trabalho afeta a saúde: ritmo e metas, jornada e pausas, clareza do que é esperado, relação com a liderança e com a equipe, autonomia, reconhecimento, comunicação e situações de assédio ou violência.", sid("CNT-000003", 8)),
          h("Conduta em emergência"),
          steps("Se soar o alarme", [
            "Interrompa a atividade em segurança (pare a máquina).",
            "Acione o alarme ou avise a liderança.",
            "Siga a rota de fuga até o ponto de encontro.",
            "Não retorne antes da liberação.",
          ], sid("CNT-000003", 9)),
          safety("Corredores e saídas de emergência livres, sempre. Caixa no corredor deixa de ser desorganização e passa a ser risco de vida."),
          call("info", "Aviso", DISCLAIMER),
        ],
      }],
    },
  ],
};

// =====================================================================
// CURSO 3 — Qualidade
// =====================================================================
const qualidade: CourseSpec = {
  id: "CRS-003",
  code: "QUAL-OLHO",
  title: "Qualidade na Confecção — Olho de Águia",
  subtitle: "Ver o defeito antes que ele vire retrabalho.",
  description: "Inspeção, classificação de defeitos, relação defeito–causa–ação, autocontrole e critério de decisão na revisão.",
  category: "qualidade",
  level: "intermediario",
  sector: "Qualidade",
  hours: 4,
  icon: "eye",
  accent: "jade",
  competencies: ["CMP-QUALIDADE", "CMP-DEFEITOS", "CMP-RETRABALHO", "CMP-FICHA-TECNICA"],
  sourceContentIds: ["CNT-000005", "CNT-000001", "CNT-000011"],
  librarySourceIds: ["SRCLIB-CONSERV-POP", "SRCLIB-ABNT-ISO9001"],
  createdAt: "2026-03-02T12:00:00.000Z",
  modules: [
    {
      title: "1. O que é qualidade aqui dentro",
      summary: "Qualidade como informação que volta para a produção.",
      lessons: [{
        title: "Revisar para informar, não para reprovar",
        summary: "O propósito da revisão e o custo do defeito que não gera informação.",
        durationMin: 8,
        fromContentId: "CNT-000005",
        refs: [ref("CNT-000005", 0), ref("CNT-000005", 8)],
        blocks: [
          ch("mestre", "Peça reprovada que não gera informação é dinheiro perdido duas vezes."),
          t("A revisão não existe para reprovar peças: existe para devolver informação à produção antes que o mesmo defeito se repita em todo o lote.", sid("CNT-000005", 0)),
          t("Todo defeito registrado deve ter posto de origem, tipo de defeito e causa provável. Esse registro é o que permite ver, no fim da semana, que metade do retrabalho de um mês veio de uma única causa evitável.", sid("CNT-000005", 8)),
          call("dica", "Pergunta certa", "Em vez de “quem errou?”, pergunte “o que permitiu o erro?”. A segunda pergunta tem resposta útil."),
        ],
      }],
    },
    {
      title: "2. Defeito, causa e ação",
      summary: "Os defeitos mais comuns em malha e a primeira verificação de cada um.",
      lessons: [{
        title: "Mapa dos defeitos em malha",
        summary: "Ponto pulando, franzido, medida, tonalidade, gola, barra e acabamento.",
        durationMin: 12,
        xp: 30,
        fromContentId: "CNT-000005",
        refs: [ref("CNT-000005", 1), ref("CNT-000005", 2), ref("CNT-000005", 3), ref("CNT-000005", 4), ref("CNT-000005", 6)],
        blocks: [
          ch("mestre", "Decorar nome de defeito não serve de nada. Saber a causa provável é o que resolve."),
          tbl(
            ["Defeito", "Causa mais provável", "Ação imediata"],
            [
              ["Ponto pulando / costura aberta", "Agulha cega, torta ou errada; passamento de linha", "Separar a peça, avisar o posto, verificar a agulha"],
              ["Costura franzida", "Diferencial inadequado, tensão alta, calcador", "Testar em retalho e ajustar"],
              ["Medida fora do especificado", "Enfesto com tensão, corte fora do traço, molde", "Comparar com a tabela e avisar o corte"],
              ["Tonalidade diferente", "Mistura de lotes de tecido", "Localizar o pacote e bloquear o lote"],
              ["Gola torta / com barriga", "Distribuição do decote, diferencial, ordem de fechamento", "Refazer distribuição e conferir o centro"],
              ["Fio solto / ponta longa", "Acabamento e faca", "Limpar e verificar borda"],
            ],
            "Tabela de defeitos em malha — ConServ",
            sid("CNT-000005", 1),
          ),
          t("Diferença de tonalidade entre partes da mesma peça indica mistura de lotes de tecido. A ação é localizar o pacote, conferir a identificação e bloquear o lote até o corte confirmar a origem.", sid("CNT-000005", 4)),
          call("atencao", "Defeito repetido", "Defeito que aparece em mais de uma peça da mesma amostra pede parada e investigação — não só separação da peça."),
        ],
      }],
    },
    {
      title: "3. Critério e decisão",
      summary: "Quando aprovar, quando retrabalhar e quando parar.",
      lessons: [{
        title: "Decidir com critério, não com achismo",
        summary: "Os quatro critérios de decisão na revisão.",
        durationMin: 8,
        fromContentId: "CNT-000005",
        refs: [ref("CNT-000005", 7)],
        blocks: [
          ch("mestre", "Na dúvida, não adivinhe. Chamar a supervisão é procedimento, não fraqueza."),
          steps("Critério de decisão", [
            "Defeito que compromete uso, resistência ou medida: peça reprovada.",
            "Defeito de acabamento recuperável: retrabalho imediato e reinspeção.",
            "Defeito repetido na amostra: parar, comunicar o posto e investigar a causa.",
            "Dúvida sobre o critério: chamar a supervisão.",
          ], sid("CNT-000005", 7)),
          call("dica", "Leve para o posto", "Registrar a causa provável junto com o defeito é o que transforma revisão em melhoria."),
        ],
      }],
    },
  ],
};

// =====================================================================
// CURSO 4 — Corte
// =====================================================================
const corte: CourseSpec = {
  id: "CRS-004",
  code: "CORTE-INT",
  title: "Corte Inteligente — Enfesto, Risco e Aproveitamento",
  subtitle: "O desperdício começa antes da tesoura.",
  description: "Enfesto sem tensão, sentido do fio, encaixe, aproveitamento, identificação de lotes e segurança no corte.",
  category: "corte",
  level: "intermediario",
  sector: "Corte",
  hours: 5,
  icon: "ruler",
  accent: "navy",
  competencies: ["CMP-ENFESTO", "CMP-RISCO-ENCAIXE", "CMP-CORTE-MAQUINA", "CMP-APROVEITAMENTO", "CMP-PERIGO-RISCO"],
  sourceContentIds: ["CNT-000004"],
  librarySourceIds: ["SRCLIB-CONSERV-POP", "SRCLIB-SENAI-VEST", "SRCLIB-MTE-NR12"],
  createdAt: "2026-03-02T12:00:00.000Z",
  modules: [
    {
      title: "1. Enfesto",
      summary: "Montar o colchão de tecido sem tensão e sem desalinhamento.",
      lessons: [{
        title: "Enfesto: onde a medida da peça é decidida",
        summary: "Relaxamento do tecido, alinhamento, altura do colchão e tensão.",
        durationMin: 10,
        fromContentId: "CNT-000004",
        refs: [ref("CNT-000004", 0), ref("CNT-000004", 1)],
        blocks: [
          ch("mestre", "Se o enfesto sai torto, nenhuma costureira do mundo conserta depois."),
          t("O enfesto é a sobreposição ordenada de folhas de tecido sobre a mesa de corte, formando um colchão com altura controlada. Um enfesto com tensão ou desalinhado produz peças fora de medida que nenhuma costura consegue corrigir.", sid("CNT-000004", 0)),
          t("O desperdício de tecido começa muitas vezes antes do corte: no encaixe mal resolvido, na largura não conferida, no enfesto refeito e na falta de conferência do risco.", sid("CNT-000004", 1)),
          call("dica", "Deixe a malha descansar", "Malha enrolada sob tensão encolhe na mesa. Desenrole e deixe relaxar antes de enfestar."),
        ],
      }],
    },
    {
      title: "2. Sentido do fio, risco e encaixe",
      summary: "Por que a seta do molde não é sugestão.",
      lessons: [{
        title: "Sentido do fio e encaixe com aproveitamento",
        summary: "Caimento, torção na lavagem e aproveitamento responsável.",
        durationMin: 10,
        fromContentId: "CNT-000004",
        refs: [ref("CNT-000004", 2), ref("CNT-000004", 3)],
        blocks: [
          ch("mestre", "Ganhar dois centímetros ignorando o sentido do fio custa a peça inteira depois da primeira lavagem."),
          t("O sentido do fio é a direção dos fios do tecido em relação ao molde. Peça cortada fora do sentido do fio torce na lavagem, estica na lateral e muda o caimento. A seta do molde indica o sentido e não pode ser ignorada para ganhar aproveitamento.", sid("CNT-000004", 2)),
          t("O risco é o desenho do conjunto de moldes na largura útil do tecido. O encaixe é a forma de organizar esses moldes para usar o mínimo de tecido possível respeitando o sentido do fio, as margens e os pares simétricos.", sid("CNT-000004", 3)),
          call("atencao", "Pares simétricos", "Peça espelhada cortada no mesmo sentido gera duas peças iguais — e uma delas não serve."),
        ],
      }],
    },
    {
      title: "3. Identificação, lote e segurança",
      summary: "O pacote identificado que viaja com a peça até a embalagem.",
      lessons: [{
        title: "Identificar é proteger o lote",
        summary: "Procedimento padrão, identificação e segurança na máquina de corte.",
        durationMin: 10,
        fromContentId: "CNT-000004",
        refs: [ref("CNT-000004", 4), ref("CNT-000004", 5), ref("CNT-000004", 6)],
        blocks: [
          ch("mestre", "Lote misturado é defeito que só aparece na peça pronta — quando já é caro."),
          steps("Procedimento padrão de corte (resumo)", [
            "Conferir ordem de produção, ficha técnica e grade.",
            "Medir a largura útil real do rolo.",
            "Deixar o tecido relaxar e enfestar alinhado, sem esticar.",
            "Conferir o risco: sentido do fio, quantidade, pares e margens.",
            "Cortar acompanhando o traço, sem forçar a curva.",
            "Identificar cada pacote: ordem, tamanho, cor, lote e quantidade.",
            "Separar por lote e registrar a saída.",
          ], sid("CNT-000004", 4)),
          t("Tecido da mesma cor em lotes diferentes pode ter tonalidade levemente distinta. Por isso o pacote identificado viaja junto com as partes até a embalagem.", sid("CNT-000004", 5)),
          safety("Proteção de lâmina nunca é removida ou amarrada. Luva de malha de aço na mão de apoio. Troca de lâmina só com a máquina desenergizada e pela manutenção."),
          t("Resíduo de tecido no chão, perto da mesa, é risco de queda e deve ser recolhido durante o turno, não apenas no fim.", sid("CNT-000004", 6)),
        ],
      }],
    },
  ],
};

// =====================================================================
// CURSO 5 — 5S
// =====================================================================
const cinco: CourseSpec = {
  id: "CRS-005",
  code: "ORG-5S",
  title: "5S no Posto de Trabalho",
  subtitle: "Menos movimento, menos cansaço, menos defeito.",
  description: "Os cinco sensos aplicados ao posto da confecção, com sinais de alerta e efeito direto de cada desvio.",
  category: "organizacao",
  level: "basico",
  sector: "Todos",
  hours: 3,
  icon: "sparkles",
  accent: "sand",
  competencies: ["CMP-5S", "CMP-PRODUTIVIDADE", "CMP-ERGONOMIA", "CMP-CULTURA"],
  sourceContentIds: ["CNT-000006", "CNT-000009"],
  librarySourceIds: ["SRCLIB-CONSERV-POP", "SRCLIB-MTE-NR17"],
  createdAt: "2026-03-02T12:00:00.000Z",
  modules: [
    {
      title: "1. Os cinco sensos",
      summary: "O que cada senso significa na prática da fábrica.",
      lessons: [{
        title: "Cinco sensos, um posto melhor",
        summary: "Utilização, organização, limpeza, padronização e disciplina.",
        durationMin: 9,
        fromContentId: "CNT-000006",
        refs: [ref("CNT-000006", 0), ref("CNT-000006", 1), ref("CNT-000006", 4), ref("CNT-000006", 5)],
        blocks: [
          ch("mestre", "5S não é faxina. É método de trabalho."),
          t("O 5S é um método de organização do trabalho formado por cinco sensos que se apoiam um no outro: utilização, organização, limpeza, padronização e disciplina. Na confecção, ele não é decoração: é tempo, qualidade e segurança.", sid("CNT-000006", 0)),
          li([
            "Utilização: separa o que serve do que não serve.",
            "Organização: lugar definido por frequência de uso.",
            "Limpeza: limpar e descobrir a causa da sujeira.",
            "Padronização: o padrão fica visível, não na memória.",
            "Disciplina: manter e corrigir no momento do desvio.",
          ], sid("CNT-000006", 0)),
          t("Padrão que só existe na cabeça de uma pessoa desaparece quando ela falta.", sid("CNT-000006", 4)),
        ],
      }],
    },
    {
      title: "2. Sinais de alerta",
      summary: "Como perceber que o 5S está caindo antes de o problema aparecer.",
      lessons: [{
        title: "Cinco sinais de que o setor está escorregando",
        summary: "Sinal, efeito direto e ação imediata.",
        durationMin: 8,
        fromContentId: "CNT-000006",
        refs: [ref("CNT-000006", 6), ref("CNT-000006", 7)],
        blocks: [
          ch("seguranca", "Dois desses sinais são risco de acidente. Consegue adivinhar quais?"),
          tbl(
            ["Sinal", "Efeito direto"],
            [
              ["Caixa no corredor de passagem", "Risco de queda e atraso na evacuação"],
              ["Retalho e fiapo sob a máquina", "Defeito de costura e trava de mecanismo"],
              ["Ferramenta sem retorno ao lugar", "Tempo parado procurando"],
              ["Retrabalho misturado com aprovado", "Peça com defeito chegando ao cliente"],
              ["Pilhas escondendo a bancada", "Movimento extra e erro de pacote"],
            ],
            "Sinais de queda do 5S",
            sid("CNT-000006", 6),
          ),
          t("Corredor obstruído é risco de queda e de atraso na evacuação; fiapo é defeito de costura; ferramenta perdida é tempo parado; peça misturada é retrabalho em dobro.", sid("CNT-000006", 7)),
        ],
      }],
    },
    {
      title: "3. Começando pelo seu posto",
      summary: "Um posto por vez, com quem trabalha nele.",
      lessons: [{
        title: "Como começar sem virar campanha",
        summary: "Escolher um posto, registrar antes e depois, combinar quem mantém.",
        durationMin: 7,
        fromContentId: "CNT-000006",
        refs: [ref("CNT-000006", 8), ref("CNT-000009", 3)],
        blocks: [
          ch("mestre", "Campanha dura duas semanas. Hábito dura anos."),
          t("O 5S começa por um posto, não pela fábrica inteira. Escolher um posto, organizar com quem trabalha nele, registrar o antes e o depois e combinar quem mantém é mais eficaz do que uma campanha geral.", sid("CNT-000006", 8)),
          steps("Seu plano em 4 passos", [
            "Fotografe seu posto hoje.",
            "Tire do posto o que não é usado no turno.",
            "Defina lugar para o que é usado a cada peça, dentro do alcance da mão.",
            "Combine com a liderança quem repõe e quem mantém.",
          ]),
          t("O alcance dos materiais deve respeitar a zona de trabalho: o que é usado a cada peça fica dentro do alcance dos antebraços, sem esticar o braço e sem girar o tronco.", sid("CNT-000009", 3)),
        ],
      }],
    },
  ],
};

export const COURSE_NR1: BuiltCourse = buildCourse(nr1);
export const COURSE_QUALIDADE: BuiltCourse = buildCourse(qualidade);
export const COURSE_CORTE: BuiltCourse = buildCourse(corte);
export const COURSE_5S: BuiltCourse = buildCourse(cinco);
