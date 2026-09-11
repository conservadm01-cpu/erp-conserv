import type { ID, Question, QuestionDifficulty, QuestionType } from "../../core/types";
import { ref } from "./contentIndex";

// =====================================================================
// BANCO DE QUESTÕES (seções 10 e 24)
// Toda questão carrega SOURCE_ID + trecho de origem. Nenhuma questão foi
// escrita "no ar": cada uma tem base em um trecho de material publicado.
// =====================================================================

interface QSpec {
  n: number;
  stem: string;
  opts: [string, string, string, string];
  correct: 0 | 1 | 2 | 3;
  why: string;
  diff?: QuestionDifficulty;
  type?: QuestionType;
  subject: string;
  comps: ID[];
  src: [string, number];
  course?: ID;
  uncertain?: boolean;
}

function q(spec: QSpec): Question {
  const id = `QST-${String(spec.n).padStart(6, "0")}`;
  const options = spec.opts.map((text, i) => ({ id: `${id}-O${i + 1}`, text }));
  return {
    id,
    stem: spec.stem,
    options,
    correctOptionId: options[spec.correct].id,
    explanation: spec.why,
    difficulty: spec.diff ?? "medio",
    type: spec.type ?? "conhecimento",
    subject: spec.subject,
    competencies: spec.comps,
    points: spec.diff === "dificil" ? 15 : spec.diff === "facil" ? 5 : 10,
    sourceRef: ref(spec.src[0], spec.src[1], spec.uncertain),
    contentId: spec.src[0],
    courseId: spec.course,
    aiGenerated: false,
    status: "approved",
    reviewedBy: "EMP-0009",
    reviewedAt: "2026-03-03T12:00:00.000Z",
    createdAt: "2026-03-02T12:00:00.000Z",
  };
}

const SPECS: QSpec[] = [
  // ---------------- Overloque e regulagem (CNT-000001) ----------------
  {
    n: 1, subject: "Regulagem da overloque", comps: ["CMP-REGULAGEM", "CMP-OVERLOQUE"], src: ["CNT-000001", 3], course: "CRS-001",
    type: "conhecimento", diff: "medio",
    stem: "Qual função está diretamente relacionada ao diferencial da overloque?",
    opts: [
      "A diferença de velocidade entre o dente de transporte dianteiro e o traseiro",
      "A força com que o fio do looper é puxado",
      "A distância entre uma laçada e a próxima",
      "A largura que a faca apara na borda",
    ],
    correct: 0,
    why: "O diferencial controla a diferença de velocidade entre os dentes de transporte dianteiro e traseiro — é isso que empurra ou estica o tecido durante a costura.",
  },
  {
    n: 2, subject: "Regulagem da overloque", comps: ["CMP-REGULAGEM"], src: ["CNT-000001", 2], course: "CRS-001",
    type: "conhecimento", diff: "facil",
    stem: "Na ConServ, qual é o comprimento de ponto padrão para malha de algodão na overloque?",
    opts: ["Entre 1,0 mm e 1,5 mm", "Entre 2,5 mm e 3,0 mm", "Entre 4,0 mm e 5,0 mm", "Não existe padrão: depende do operador"],
    correct: 1,
    why: "O padrão da casa para malha de algodão é entre 2,5 mm e 3,0 mm. Ponto muito curto sobrecarrega o tecido; muito longo reduz a resistência.",
  },
  {
    n: 3, subject: "Regulagem da overloque", comps: ["CMP-REGULAGEM", "CMP-QUALIDADE"], src: ["CNT-000001", 1], course: "CRS-001",
    type: "solucao_problema", diff: "medio",
    stem: "A costura saiu dura, com a linha marcando o tecido e a peça com tendência a franzir. Qual é a hipótese mais provável?",
    opts: ["Tensão da agulha baixa demais", "Comprimento do ponto curto demais", "Tensão da agulha alta demais", "Faca desalinhada"],
    correct: 2,
    why: "Tensão alta na agulha endurece a costura, marca a linha no tecido e tende a franzir a peça. Tensão baixa produz o efeito oposto: ponto frouxo que abre ao esticar.",
  },
  {
    n: 4, subject: "Regulagem da overloque", comps: ["CMP-REGULAGEM", "CMP-OVERLOQUE"], src: ["CNT-000001", 6], course: "CRS-001",
    type: "sequencia_operacional", diff: "medio",
    stem: "O tecido está franzindo na overloque. Qual é a primeira verificação do roteiro da ConServ?",
    opts: [
      "Conferir o diferencial e testar em retalho do mesmo tecido",
      "Aumentar a pressão do calcador",
      "Trocar a linha do looper inferior",
      "Chamar a manutenção imediatamente",
    ],
    correct: 0,
    why: "O roteiro começa pelo diferencial, testando em retalho do mesmo tecido; depois vêm tensão, calcador e agulha. A manutenção é acionada se o franzido persistir.",
  },
  {
    n: 5, subject: "Regulagem da overloque", comps: ["CMP-REGULAGEM", "CMP-AGULHA-LINHA"], src: ["CNT-000001", 7], course: "CRS-001",
    type: "solucao_problema", diff: "facil",
    stem: "O ponto está pulando na overloque. Qual é a primeira providência?",
    opts: ["Aumentar o comprimento do ponto", "Trocar a agulha", "Reduzir a pressão do calcador", "Afrouxar a tensão do looper superior"],
    correct: 1,
    why: "Agulha cega, torta ou de ponta errada é a causa mais comum de ponto pulando. Por isso a troca da agulha é a primeira verificação.",
  },
  {
    n: 6, subject: "Regulagem da overloque", comps: ["CMP-OVERLOQUE"], src: ["CNT-000001", 0], course: "CRS-001",
    type: "conhecimento", diff: "facil",
    stem: "O que a overloque faz ao mesmo tempo em uma única passada?",
    opts: [
      "Fecha, arremata a borda e apara o excesso de tecido",
      "Faz barra e aplica elástico",
      "Fecha e faz pesponto decorativo",
      "Corta o molde e fecha a lateral",
    ],
    correct: 0,
    why: "A overloque fecha a costura, arremata a borda com os loopers e apara o excesso com a faca — tudo na mesma passada.",
  },
  {
    n: 7, subject: "Regulagem da overloque", comps: ["CMP-REGULAGEM"], src: ["CNT-000001", 4], course: "CRS-001",
    type: "interpretacao", diff: "medio",
    stem: "Qual é o efeito de uma pressão excessiva do calcador em malha?",
    opts: [
      "Melhora o transporte e reduz o franzido",
      "Marca a malha e atrapalha o funcionamento do diferencial",
      "Aumenta a resistência da costura",
      "Não tem efeito relevante em malha",
    ],
    correct: 1,
    why: "Pressão excessiva marca a malha e prejudica o diferencial; pressão insuficiente deixa o tecido escapar, gerando ponto irregular.",
  },
  {
    n: 8, subject: "Regulagem da overloque", comps: ["CMP-OVERLOQUE", "CMP-MANUTENCAO"], src: ["CNT-000001", 5], course: "CRS-001",
    type: "situacao_pratica", diff: "facil",
    stem: "A faca da overloque está deixando fio solto na borda. Qual é a conduta correta do operador?",
    opts: [
      "Afiar a faca no próprio posto",
      "Aumentar a tensão dos loopers para esconder o fio",
      "Parar a máquina e solicitar apoio da manutenção",
      "Reduzir o comprimento do ponto",
    ],
    correct: 2,
    why: "Troca e ajuste de faca são tarefas da manutenção. O operador para a máquina e solicita apoio — não improvisa ajuste em ferramenta de corte.",
  },
  {
    n: 9, subject: "Regulagem da overloque", comps: ["CMP-REGULAGEM", "CMP-QUALIDADE"], src: ["CNT-000001", 8], course: "CRS-001",
    type: "situacao_pratica", diff: "facil",
    stem: "Antes de iniciar um lote novo, qual teste rápido evita retrabalho em centenas de peças?",
    opts: [
      "Costurar um retalho do mesmo tecido e esticar a costura com as duas mãos",
      "Costurar a primeira peça inteira e mandar para a revisão",
      "Trocar todas as linhas da máquina",
      "Aumentar o diferencial por precaução",
    ],
    correct: 0,
    why: "O teste em retalho do mesmo tecido, esticando a costura, mostra em segundos se o ponto acompanha o tecido e se a borda está limpa.",
  },
  {
    n: 10, subject: "Regulagem da overloque", comps: ["CMP-REGULAGEM"], src: ["CNT-000001", 3], course: "CRS-001",
    type: "interpretacao", diff: "dificil",
    stem: "Em uma gola de malha leve que está ficando com barriga, qual ajuste de diferencial faz sentido investigar primeiro?",
    opts: [
      "Diferencial abaixo de 1, para esticar o tecido",
      "Diferencial acima de 1, para empurrar o tecido e tender a encolher a costura",
      "Diferencial não influencia gola",
      "Desligar o diferencial",
    ],
    correct: 1,
    why: "Diferencial acima de 1 empurra o tecido e faz a costura tender a encolher, o que ajuda a evitar barriga em gola e recortes de malha leve. O ajuste deve ser testado em retalho.",
  },

  // ---------------- Agulhas e linhas (CNT-000002) ----------------
  {
    n: 11, subject: "Agulhas e linhas", comps: ["CMP-AGULHA-LINHA"], src: ["CNT-000002", 1], course: "CRS-001",
    type: "conhecimento", diff: "facil",
    stem: "Por que a agulha de ponta esférica (ball point) é obrigatória em malha?",
    opts: [
      "Porque ela afasta os fios da malha em vez de cortá-los",
      "Porque ela é mais resistente que a ponta aguda",
      "Porque ela permite usar linha mais grossa",
      "Porque ela aumenta a velocidade da máquina",
    ],
    correct: 0,
    why: "A ponta esférica afasta os fios da malha. Ponta cortante em malha abre furinhos que aparecem depois da primeira lavagem, já na casa do cliente.",
  },
  {
    n: 12, subject: "Agulhas e linhas", comps: ["CMP-AGULHA-LINHA"], src: ["CNT-000002", 2], course: "CRS-001",
    type: "conhecimento", diff: "medio",
    stem: "O que indica a numeração da agulha na escala métrica (70, 80, 90)?",
    opts: ["O tipo de ponta", "A espessura do corpo da agulha em centésimos de milímetro", "O comprimento da agulha", "A marca do fabricante"],
    correct: 1,
    why: "A numeração indica a espessura do corpo: 70 equivale a 0,70 mm e 90 a 0,90 mm. Quanto mais fino o tecido, mais fina a agulha.",
  },
  {
    n: 13, subject: "Agulhas e linhas", comps: ["CMP-AGULHA-LINHA"], src: ["CNT-000002", 2], course: "CRS-001",
    type: "situacao_pratica", diff: "medio",
    stem: "Para malha leve (fio 30.1), qual agulha é indicada no padrão da ConServ?",
    opts: ["90 de ponta aguda", "110 de ponta esférica", "70 ou 75 de ponta esférica", "80 de ponta aguda"],
    correct: 2,
    why: "Malha leve usa agulha 70 ou 75 de ponta esférica; malha média usa 80; malha pesada e plano médio usam 90.",
  },
  {
    n: 14, subject: "Agulhas e linhas", comps: ["CMP-AGULHA-LINHA", "CMP-QUALIDADE"], src: ["CNT-000002", 3], course: "CRS-001",
    type: "solucao_problema", diff: "medio",
    stem: "A linha está esquentando, desfiando e arrebentando. Qual combinação explica melhor esse conjunto de sintomas?",
    opts: ["Linha fina em agulha grossa", "Linha grossa em agulha fina", "Ponto muito longo", "Diferencial acima de 1"],
    correct: 1,
    why: "Linha grossa em agulha fina não tem espaço no furo e na canaleta: ela esquenta, desfia e arrebenta. Linha fina em agulha grossa dá o problema oposto — ponto frouxo e marcado.",
  },
  {
    n: 15, subject: "Agulhas e linhas", comps: ["CMP-AGULHA-LINHA"], src: ["CNT-000002", 4], course: "CRS-001",
    type: "situacao_pratica", diff: "facil",
    stem: "A agulha caiu no chão durante a troca. O que fazer?",
    opts: [
      "Limpar e recolocar na máquina",
      "Encaminhar ao recipiente de descarte de agulhas",
      "Guardar na gaveta para emergência",
      "Verificar com a unha se a ponta está boa e reutilizar",
    ],
    correct: 1,
    why: "Agulha que caiu no chão vai para o recipiente de descarte, nunca de volta à máquina: a ponta pode ter microdanos que cortam a malha.",
  },
  {
    n: 16, subject: "Agulhas e linhas", comps: ["CMP-AGULHA-LINHA", "CMP-PERIGO-RISCO"], src: ["CNT-000002", 5], course: "CRS-001",
    type: "identificacao_risco", diff: "facil",
    stem: "Qual é o destino correto de uma agulha quebrada?",
    opts: [
      "Lixo comum do setor",
      "Recipiente rígido identificado para descarte de agulhas",
      "Caixa de retalhos",
      "Pode ficar na bancada até o fim do turno",
    ],
    correct: 1,
    why: "Agulha solta no lixo comum fere quem manuseia o resíduo. O descarte é em recipiente rígido identificado.",
  },
  {
    n: 17, subject: "Agulhas e linhas", comps: ["CMP-AGULHA-LINHA"], src: ["CNT-000002", 3], course: "CRS-001",
    type: "interpretacao", diff: "dificil",
    stem: "No sistema Nm de títulos de linha, o que significa um número maior?",
    opts: ["Linha mais grossa", "Linha mais fina", "Linha com mais torção", "Linha mais resistente à luz"],
    correct: 1,
    why: "No sistema Nm, quanto maior o número do título, mais fina é a linha. Para malha, a linha 120 de poliéster texturizado no looper dá elasticidade ao arremate.",
  },

  // ---------------- NR-1 (CNT-000003) ----------------
  {
    n: 18, subject: "NR-1 — conceitos", comps: ["CMP-NR1", "CMP-PERIGO-RISCO"], src: ["CNT-000003", 1], course: "CRS-002",
    type: "conhecimento", diff: "facil",
    stem: "Qual alternativa descreve corretamente a diferença entre perigo e risco?",
    opts: [
      "Perigo é a fonte com potencial de causar dano; risco é a combinação entre probabilidade e gravidade",
      "Perigo e risco são sinônimos na NR-1",
      "Perigo é o dano já ocorrido; risco é o dano possível",
      "Perigo é o que a empresa controla; risco é o que o trabalhador controla",
    ],
    correct: 0,
    why: "Perigo é a fonte com potencial de causar lesão ou agravo à saúde. Risco é a combinação entre a probabilidade de ocorrer e a gravidade do que pode ocorrer.",
  },
  {
    n: 19, subject: "NR-1 — GRO e PGR", comps: ["CMP-NR1"], src: ["CNT-000003", 2], course: "CRS-002",
    type: "conhecimento", diff: "medio",
    stem: "O GRO (Gerenciamento de Riscos Ocupacionais) é melhor descrito como:",
    opts: [
      "Um documento arquivado no setor de pessoal",
      "Um treinamento anual obrigatório",
      "Um processo contínuo de identificar, avaliar, prevenir, acompanhar e revisar",
      "Uma lista de EPIs por função",
    ],
    correct: 2,
    why: "O GRO é um ciclo contínuo: identificar perigos, avaliar riscos, definir medidas, acompanhar a eficácia e revisar quando algo muda. Não é um documento.",
  },
  {
    n: 20, subject: "NR-1 — GRO e PGR", comps: ["CMP-NR1"], src: ["CNT-000003", 3], course: "CRS-002",
    type: "conhecimento", diff: "medio",
    stem: "Quais são os dois documentos que sustentam o PGR?",
    opts: [
      "Inventário de riscos e plano de ação",
      "Ficha de EPI e ordem de serviço",
      "Atestado de saúde e mapa de risco",
      "Laudo de insalubridade e PPP",
    ],
    correct: 0,
    why: "O PGR se sustenta no inventário de riscos (perigos, riscos e quem está exposto) e no plano de ação (o que, quem, quando e como verificar).",
  },
  {
    n: 21, subject: "NR-1 — prevenção", comps: ["CMP-NR1", "CMP-PERIGO-RISCO"], src: ["CNT-000003", 5], course: "CRS-002",
    type: "interpretacao", diff: "medio",
    stem: "Na ordem de prioridade das medidas de prevenção, o EPI ocupa qual posição?",
    opts: ["A primeira, por ser mais rápido de implantar", "A última, como barreira final", "A segunda, depois de eliminar o perigo", "Não faz parte da ordem de prioridade"],
    correct: 1,
    why: "A ordem é: eliminar, reduzir na fonte, reduzir pela organização do trabalho, medidas administrativas/sinalização e, por último, EPI. O EPI não substitui as medidas anteriores.",
  },
  {
    n: 22, subject: "NR-1 — direitos e deveres", comps: ["CMP-NR1"], src: ["CNT-000003", 6], course: "CRS-002",
    type: "conhecimento", diff: "facil",
    stem: "Entre os deveres do trabalhador previstos no conteúdo educativo da NR-1 está:",
    opts: [
      "Elaborar o inventário de riscos do setor",
      "Definir as medidas de controle de engenharia",
      "Comunicar situações de risco ao superior imediato",
      "Aprovar o plano de ação do PGR",
    ],
    correct: 2,
    why: "Comunicar situações de risco é dever do trabalhador. Elaborar inventário, definir medidas de engenharia e aprovar plano de ação são responsabilidades da empresa e dos responsáveis técnicos.",
  },
  {
    n: 23, subject: "NR-1 — quase acidente", comps: ["CMP-NR1", "CMP-PERIGO-RISCO"], src: ["CNT-000003", 7], course: "CRS-002",
    type: "situacao_pratica", diff: "facil",
    stem: "Uma caixa caiu de uma pilha e passou perto de uma colega, sem atingir ninguém. Como tratar esse evento?",
    opts: [
      "Não precisa comunicar, pois ninguém se machucou",
      "Comunicar como quase acidente, do mesmo jeito que um acidente",
      "Comunicar apenas se acontecer uma segunda vez",
      "Anotar no caderno do posto e resolver internamente",
    ],
    correct: 1,
    why: "O quase acidente mostra uma falha real sem ninguém se machucar — é a informação mais barata da segurança e deve ser comunicada como um acidente, sem busca de culpado.",
  },
  {
    n: 24, subject: "NR-1 — psicossocial", comps: ["CMP-PSICOSSOCIAL", "CMP-NR1"], src: ["CNT-000003", 8], course: "CRS-002",
    type: "conhecimento", diff: "medio",
    stem: "Os fatores de risco psicossociais relacionados ao trabalho tratam de:",
    opts: [
      "Apenas de conflitos pessoais fora da empresa",
      "Como a organização do trabalho afeta a saúde: ritmo, metas, jornada, pausas, clareza, relações, autonomia e comunicação",
      "Exclusivamente de assédio moral",
      "Exames médicos periódicos",
    ],
    correct: 1,
    why: "Eles tratam de como a organização do trabalho afeta a saúde — ritmo e metas, jornada e pausas, clareza do que é esperado, relações, autonomia, reconhecimento, comunicação e situações de assédio ou violência.",
  },
  {
    n: 25, subject: "NR-1 — emergência", comps: ["CMP-EMERGENCIA"], src: ["CNT-000003", 9], course: "CRS-002",
    type: "sequencia_operacional", diff: "medio",
    stem: "Ao soar o alarme de emergência durante a produção, qual é a sequência correta?",
    opts: [
      "Terminar a peça, depois parar e sair",
      "Interromper a atividade em segurança, acionar o alarme ou avisar a liderança, seguir a rota de fuga e aguardar liberação",
      "Sair imediatamente pela porta mais próxima, mesmo com a máquina ligada",
      "Esperar orientação sem sair do posto",
    ],
    correct: 1,
    why: "A conduta é interromper a atividade em segurança (parando a máquina), acionar o alarme ou a liderança, seguir a rota de fuga até o ponto de encontro e não retornar antes da liberação.",
  },
  {
    n: 26, subject: "NR-1 — perigos na confecção", comps: ["CMP-PERIGO-RISCO"], src: ["CNT-000003", 4], course: "CRS-002",
    type: "identificacao_risco", diff: "facil",
    stem: "Qual destes é um perigo típico do setor de estamparia?",
    opts: ["Produtos químicos de limpeza e recuperação de tela", "Excesso de moldes na mesa", "Linha de cor errada", "Ficha técnica desatualizada"],
    correct: 0,
    why: "Produtos químicos, calor de prensa e estufa e ventilação são perigos típicos da estamparia. Os demais itens são problemas de processo e qualidade, não perigos de segurança.",
  },
  {
    n: 27, subject: "NR-1 — conceitos", comps: ["CMP-NR1"], src: ["CNT-000003", 0], course: "CRS-002",
    type: "interpretacao", diff: "dificil",
    stem: "Sobre o uso deste material educativo de NR-1, qual afirmação é correta?",
    opts: [
      "Ele substitui a leitura da norma oficial e dispensa o responsável técnico",
      "Ele é conteúdo educativo; a aplicação específica exige a norma oficial e o responsável técnico da empresa",
      "Ele tem validade jurídica como parecer técnico",
      "Ele equivale a treinamento normativo obrigatório registrado",
    ],
    correct: 1,
    why: "O material é educativo. A aplicação específica deve ser tratada com o responsável técnico e com a leitura do texto oficial publicado pelo Ministério do Trabalho e Emprego.",
  },

  // ---------------- Corte (CNT-000004) ----------------
  {
    n: 28, subject: "Corte e enfesto", comps: ["CMP-ENFESTO"], src: ["CNT-000004", 0], course: "CRS-004",
    type: "conhecimento", diff: "facil",
    stem: "O que é o enfesto?",
    opts: [
      "O desenho dos moldes na largura do tecido",
      "A sobreposição ordenada de folhas de tecido formando um colchão de altura controlada",
      "A separação dos pacotes por tamanho",
      "O corte das peças com máquina vertical",
    ],
    correct: 1,
    why: "Enfesto é a sobreposição ordenada de folhas sobre a mesa, formando um colchão de altura controlada para cortar todas as folhas com a mesma medida.",
  },
  {
    n: 29, subject: "Corte e enfesto", comps: ["CMP-RISCO-ENCAIXE", "CMP-APROVEITAMENTO"], src: ["CNT-000004", 2], course: "CRS-004",
    type: "interpretacao", diff: "medio",
    stem: "Cortar uma peça fora do sentido do fio provoca principalmente:",
    opts: [
      "Torção na lavagem, estiramento na lateral e mudança de caimento",
      "Aumento da resistência da costura",
      "Redução do consumo de linha",
      "Melhor aproveitamento sem efeito na peça",
    ],
    correct: 0,
    why: "Peça fora do sentido do fio torce na lavagem, estica na lateral e muda o caimento. Ganhar aproveitamento ignorando a seta do molde custa a peça.",
  },
  {
    n: 30, subject: "Corte e enfesto", comps: ["CMP-APROVEITAMENTO"], src: ["CNT-000004", 1], course: "CRS-004",
    type: "interpretacao", diff: "medio",
    stem: "Segundo o procedimento do setor de corte, onde o desperdício de tecido costuma começar?",
    opts: [
      "Na costura, por causa da margem",
      "Na embalagem, por causa da dobra",
      "Antes do corte: encaixe mal resolvido, largura não conferida, enfesto refeito e falta de conferência do risco",
      "No estoque, por causa do armazenamento",
    ],
    correct: 2,
    why: "O desperdício começa antes do corte. Cada centímetro de sobra multiplicado pelo número de folhas vira metro no fim do mês.",
  },
  {
    n: 31, subject: "Corte e enfesto", comps: ["CMP-ENFESTO"], src: ["CNT-000004", 4], course: "CRS-004",
    type: "sequencia_operacional", diff: "medio",
    stem: "No procedimento padrão, o que deve ser feito antes de enfestar a malha?",
    opts: [
      "Deixar o tecido relaxar depois de desenrolado",
      "Grampear o risco",
      "Separar os pacotes por tamanho",
      "Afiar a lâmina da máquina de corte",
    ],
    correct: 0,
    why: "Malha enrolada sob tensão encolhe na mesa. Por isso o tecido é desenrolado e deixado relaxar antes do enfesto.",
  },
  {
    n: 32, subject: "Corte e enfesto", comps: ["CMP-CORTE-MAQUINA", "CMP-QUALIDADE"], src: ["CNT-000004", 5], course: "CRS-004",
    type: "situacao_pratica", diff: "dificil",
    stem: "Por que o pacote identificado deve viajar junto com as partes até a embalagem?",
    opts: [
      "Para facilitar a contagem na expedição",
      "Porque lotes diferentes da mesma cor podem ter tonalidade distinta e a diferença aparece na peça pronta",
      "Porque a etiqueta é exigência do cliente",
      "Para controlar o tempo de cada operação",
    ],
    correct: 1,
    why: "Tecido da mesma cor em lotes diferentes pode ter tonalidade levemente distinta. Se as partes de uma peça vierem de lotes diferentes, a diferença aparece na peça pronta e gera devolução.",
  },
  {
    n: 33, subject: "Segurança no corte", comps: ["CMP-PERIGO-RISCO", "CMP-CORTE-MAQUINA"], src: ["CNT-000004", 6], course: "CRS-004",
    type: "identificacao_risco", diff: "facil",
    stem: "Na máquina de corte vertical, qual prática é correta?",
    opts: [
      "Amarrar a proteção da lâmina para enxergar melhor o traço",
      "Usar luva de malha de aço na mão de apoio e manter a proteção da lâmina",
      "Trocar a lâmina com a máquina ligada para agilizar",
      "Apoiar o tecido com a mão livre sem luva, com cuidado",
    ],
    correct: 1,
    why: "A proteção da lâmina nunca é removida ou amarrada, a luva de malha de aço é obrigatória na mão de apoio e a troca de lâmina exige máquina desenergizada, por conta da manutenção.",
  },

  // ---------------- Qualidade (CNT-000005) ----------------
  {
    n: 34, subject: "Qualidade", comps: ["CMP-QUALIDADE"], src: ["CNT-000005", 0], course: "CRS-003",
    type: "interpretacao", diff: "facil",
    stem: "Para que serve a revisão, segundo o guia de qualidade da ConServ?",
    opts: [
      "Para reprovar peças e medir o desempenho individual",
      "Para devolver informação à produção antes que o defeito se repita no lote",
      "Para aumentar o tempo de inspeção por peça",
      "Para separar peças de segunda linha para venda",
    ],
    correct: 1,
    why: "A revisão existe para devolver informação à produção. Peça reprovada que não gera informação é dinheiro perdido duas vezes.",
  },
  {
    n: 35, subject: "Qualidade", comps: ["CMP-DEFEITOS", "CMP-AGULHA-LINHA"], src: ["CNT-000005", 1], course: "CRS-003",
    type: "solucao_problema", diff: "facil",
    stem: "Costura aberta com ponto pulando aponta, como causa mais provável, para:",
    opts: ["Agulha cega, torta ou de ponta errada", "Linha de cor errada", "Molde desatualizado", "Dobra fora do padrão"],
    correct: 0,
    why: "A causa mais provável é agulha cega, torta ou de ponta errada, seguida de passamento incorreto da linha e de sincronismo de máquina.",
  },
  {
    n: 36, subject: "Qualidade", comps: ["CMP-DEFEITOS", "CMP-FICHA-TECNICA"], src: ["CNT-000005", 3], course: "CRS-003",
    type: "solucao_problema", diff: "dificil",
    stem: "A medida está fora do especificado em toda a amostra do lote. Onde o problema provavelmente está?",
    opts: [
      "Na costura, por tensão de linha",
      "Antes da costura: enfesto com tensão, corte fora do traço ou molde desatualizado",
      "Na embalagem, por causa da dobra",
      "Na revisão, por erro de leitura da fita",
    ],
    correct: 1,
    why: "Quando a medida está fora em toda a amostra, o problema normalmente está antes da costura: enfesto com tensão, corte fora do traço ou molde desatualizado.",
  },
  {
    n: 37, subject: "Qualidade", comps: ["CMP-QUALIDADE", "CMP-RETRABALHO"], src: ["CNT-000005", 7], course: "CRS-003",
    type: "situacao_pratica", diff: "medio",
    stem: "O mesmo defeito apareceu em três peças da mesma amostra. Qual é a conduta correta?",
    opts: [
      "Separar as três peças e continuar a inspeção normalmente",
      "Reprovar o lote inteiro imediatamente",
      "Parar, comunicar o posto de origem e investigar a causa antes de liberar",
      "Retrabalhar as peças e não registrar, para não parar a linha",
    ],
    correct: 2,
    why: "Defeito repetido na mesma amostra indica causa ativa no processo: é preciso parar, comunicar o posto e investigar antes de liberar a continuidade.",
  },
  {
    n: 38, subject: "Qualidade", comps: ["CMP-QUALIDADE"], src: ["CNT-000005", 9], course: "CRS-003",
    type: "conhecimento", diff: "facil",
    stem: "O que é autocontrole na confecção?",
    opts: [
      "A inspeção feita pela própria operadora na primeira peça, antes de produzir o lote",
      "O controle de ponto e hora extra",
      "A auditoria mensal da qualidade",
      "A inspeção 100% feita no fim da linha",
    ],
    correct: 0,
    why: "Autocontrole é a conferência que a própria operadora faz na primeira peça — medida, ponto e acabamento — antes de produzir as demais.",
  },
  {
    n: 39, subject: "Qualidade", comps: ["CMP-DEFEITOS"], src: ["CNT-000005", 6], course: "CRS-003",
    type: "interpretacao", diff: "medio",
    stem: "Por que fio solto e ponta de linha longa são defeitos relevantes, mesmo parecendo pequenos?",
    opts: [
      "Porque reduzem a resistência da costura",
      "Porque são os primeiros que o cliente final percebe na peça dobrada",
      "Porque alteram a medida da peça",
      "Porque impedem a dobra padrão",
    ],
    correct: 1,
    why: "Defeitos de acabamento são os que o cliente percebe primeiro, porque aparecem na peça dobrada na prateleira.",
  },
  {
    n: 40, subject: "Qualidade", comps: ["CMP-DEFEITOS", "CMP-REGULAGEM"], src: ["CNT-000005", 2], course: "CRS-003",
    type: "solucao_problema", diff: "medio",
    stem: "Costura franzida em malha costuma vir de quais causas?",
    opts: [
      "Diferencial inadequado, tensão alta da agulha ou pressão excessiva do calcador",
      "Linha fina e agulha fina",
      "Ponto curto e faca nova",
      "Molde com margem pequena",
    ],
    correct: 0,
    why: "As causas típicas são diferencial inadequado, tensão alta na linha da agulha e pressão excessiva do calcador — além de puxar a peça durante a costura.",
  },

  // ---------------- 5S (CNT-000006) ----------------
  {
    n: 41, subject: "5S", comps: ["CMP-5S"], src: ["CNT-000006", 0], course: "CRS-005",
    type: "conhecimento", diff: "facil",
    stem: "Quais são os cinco sensos do 5S?",
    opts: [
      "Utilização, organização, limpeza, padronização e disciplina",
      "Segurança, saúde, sustentabilidade, serviço e satisfação",
      "Separar, somar, simplificar, sinalizar e supervisionar",
      "Selecionar, sentar, sorrir, servir e seguir",
    ],
    correct: 0,
    why: "Os cinco sensos são utilização, organização, limpeza, padronização e disciplina — e se apoiam um no outro.",
  },
  {
    n: 42, subject: "5S", comps: ["CMP-5S", "CMP-MANUTENCAO"], src: ["CNT-000006", 3], course: "CRS-005",
    type: "interpretacao", diff: "medio",
    stem: "Por que limpar fiapo da máquina é considerado manutenção de primeiro nível?",
    opts: [
      "Porque melhora a aparência do setor",
      "Porque fiapo acumulado no transportador e no ponto de laçada causa ponto irregular e trava mecanismo",
      "Porque reduz o consumo de energia",
      "Porque substitui a manutenção preventiva",
    ],
    correct: 1,
    why: "Fiapo acumulado interfere no transporte e na formação do ponto, gerando defeito e travamento. Limpar no fim do turno é tarefa do operador.",
  },
  {
    n: 43, subject: "5S", comps: ["CMP-5S", "CMP-PERIGO-RISCO"], src: ["CNT-000006", 7], course: "CRS-005",
    type: "identificacao_risco", diff: "facil",
    stem: "Caixa de peça pronta ocupando o corredor de passagem representa, principalmente:",
    opts: ["Problema estético", "Risco de queda e de atraso na evacuação", "Falha de inventário", "Excesso de produção"],
    correct: 1,
    why: "Corredor obstruído é risco de queda e de atraso na evacuação em caso de emergência — deixa de ser desorganização e passa a ser risco.",
  },
  {
    n: 44, subject: "5S", comps: ["CMP-5S"], src: ["CNT-000006", 4], course: "CRS-005",
    type: "interpretacao", diff: "medio",
    stem: "O senso de padronização se traduz na prática por:",
    opts: [
      "Padrões visíveis: marcação de lugar, etiqueta, quadro de sequência operacional",
      "Cada um organizar como preferir",
      "Reuniões semanais de alinhamento",
      "Auditoria surpresa mensal",
    ],
    correct: 0,
    why: "Padronização transforma o que funcionou em regra visível. Padrão que só existe na cabeça de uma pessoa desaparece quando ela falta.",
  },

  // ---------------- Silk (CNT-000007) ----------------
  {
    n: 45, subject: "Silk screen", comps: ["CMP-SILK-IMPRESSAO"], src: ["CNT-000007", 6],
    type: "interpretacao", diff: "medio",
    stem: "Tinta mal curada na estamparia causa, tipicamente:",
    opts: [
      "Estampa fora de registro",
      "Estampa que racha, desbota e sai na lavagem, já no cliente",
      "Borda serrilhada no desenho",
      "Falha de cobertura na primeira passada",
    ],
    correct: 1,
    why: "A cura fixa a tinta. Se ela falha, o defeito aparece depois — racha, desbota e sai na lavagem, na casa do cliente.",
  },
  {
    n: 46, subject: "Silk screen", comps: ["CMP-SILK-TELA"], src: ["CNT-000007", 3],
    type: "solucao_problema", diff: "dificil",
    stem: "Detalhes finos do desenho não abriram na revelação da tela. Qual hipótese investigar?",
    opts: ["Subexposição na gravação", "Superexposição na gravação", "Mesh baixo demais", "Emulsão aplicada em um só lado"],
    correct: 1,
    why: "Superexposição fecha detalhes finos que não abrem na revelação; subexposição faz a emulsão sair e a estampa perder área.",
  },

  // ---------------- Embalagem (CNT-000008) ----------------
  {
    n: 47, subject: "Embalagem", comps: ["CMP-EMBALAGEM"], src: ["CNT-000008", 4],
    type: "conhecimento", diff: "facil",
    stem: "Qual conjunto de informações deve constar na identificação de cada embalagem?",
    opts: [
      "Modelo, cor, tamanho, quantidade e lote",
      "Apenas modelo e tamanho",
      "Nome da costureira e data",
      "Preço e código de barras",
    ],
    correct: 0,
    why: "Cada embalagem traz modelo, cor, tamanho, quantidade e lote; cada caixa traz a identificação do pedido e o formato caixa X de Y.",
  },
  {
    n: 48, subject: "Embalagem", comps: ["CMP-EMBALAGEM", "CMP-QUALIDADE"], src: ["CNT-000008", 0],
    type: "interpretacao", diff: "medio",
    stem: "Por que a conferência na embalagem é especialmente crítica?",
    opts: [
      "Porque é o posto com mais pessoas",
      "Porque é o último posto: o que passar dali sai como está",
      "Porque a embalagem define o preço",
      "Porque o cliente visita esse setor",
    ],
    correct: 1,
    why: "A embalagem é o último posto da fábrica e o primeiro contato do cliente com a peça: o que passar dali não tem mais revisão.",
  },

  // ---------------- Ergonomia (CNT-000009) ----------------
  {
    n: 49, subject: "Ergonomia", comps: ["CMP-ERGONOMIA"], src: ["CNT-000009", 0], course: "CRS-002",
    type: "conhecimento", diff: "facil",
    stem: "Ergonomia, em uma frase, é:",
    opts: [
      "Adaptar o trabalho à pessoa",
      "Adaptar a pessoa ao trabalho",
      "Aumentar a velocidade do posto",
      "Padronizar a altura de todas as cadeiras",
    ],
    correct: 0,
    why: "Ergonomia é adaptar o trabalho à pessoa — e não o contrário. Por isso o ajuste do posto é individual.",
  },
  {
    n: 50, subject: "Ergonomia", comps: ["CMP-ERGONOMIA"], src: ["CNT-000009", 2], course: "CRS-002",
    type: "solucao_problema", diff: "medio",
    stem: "Durante a costura, os ombros ficam elevados o tempo todo. O que investigar primeiro?",
    opts: [
      "A altura da mesa em relação à cadeira",
      "A tensão da linha",
      "A iluminação do setor",
      "O tipo de agulha",
    ],
    correct: 0,
    why: "Ombro elevado indica mesa alta ou cadeira baixa. Ombro elevado por horas é origem de dor cervical e tendinite.",
  },
  {
    n: 51, subject: "Ergonomia", comps: ["CMP-ERGONOMIA", "CMP-COMUNICACAO"], src: ["CNT-000009", 6], course: "CRS-002",
    type: "identificacao_risco", diff: "facil",
    stem: "Qual destes sinais deve ser comunicado à liderança ou ao serviço de saúde?",
    opts: [
      "Formigamento nas mãos e dor que continua depois do turno",
      "Cansaço normal no fim do dia que passa com o descanso",
      "Vontade de mudar o layout do posto",
      "Preferência por outro modelo de cadeira",
    ],
    correct: 0,
    why: "Formigamento, dor persistente após o turno, perda de força e dor ao levantar o braço são sinais de alerta. Comunicar cedo permite ajustar o posto antes de virar afastamento.",
  },

  // ---------------- Sequência operacional (CNT-000011) ----------------
  {
    n: 52, subject: "Sequência operacional", comps: ["CMP-SEQ-OPERACIONAL"], src: ["CNT-000011", 1], course: "CRS-001",
    type: "sequencia_operacional", diff: "medio",
    stem: "Na montagem da camiseta básica, qual é a ordem correta destas operações?",
    opts: [
      "Gola → ombro → manga → lateral",
      "Ombro → gola → manga → lateral",
      "Manga → ombro → gola → lateral",
      "Lateral → ombro → gola → manga",
    ],
    correct: 1,
    why: "Fecha-se o ombro, aplica-se a gola (que precisa de decote contínuo), prega-se a manga aberta e só então fecha-se lateral e manga.",
  },
  {
    n: 53, subject: "Sequência operacional", comps: ["CMP-SEQ-OPERACIONAL"], src: ["CNT-000011", 3], course: "CRS-001",
    type: "interpretacao", diff: "dificil",
    stem: "Por que a manga é pregada antes de fechar a lateral?",
    opts: [
      "Para economizar linha",
      "Porque com a lateral fechada a cava vira um tubo estreito, com risco de torcer e prender a peça",
      "Porque a manga precisa ser medida depois",
      "Porque o diferencial muda com a lateral aberta",
    ],
    correct: 1,
    why: "Com a lateral fechada, a cava se torna um tubo estreito e a costura passa a ser feita em espaço apertado, com alto risco de torcer e prender a peça.",
  },
  {
    n: 54, subject: "Sequência operacional", comps: ["CMP-SEQ-OPERACIONAL", "CMP-QUALIDADE"], src: ["CNT-000011", 5], course: "CRS-001",
    type: "situacao_pratica", diff: "facil",
    stem: "Surgiu um problema de qualidade no meio do lote. Qual é a regra da casa?",
    opts: [
      "Terminar o lote e avisar no fim do turno",
      "Parar, avisar e não seguir produzindo peça com defeito conhecido",
      "Separar as peças com defeito e continuar no mesmo ritmo",
      "Reduzir a velocidade e continuar",
    ],
    correct: 1,
    why: "Produzir cem peças erradas é sempre mais caro do que parar dez minutos. A regra é parar, avisar e não seguir com defeito conhecido.",
  },

  // ---------------- Produtividade (CNT-000012) ----------------
  {
    n: 55, subject: "Produtividade", comps: ["CMP-PRODUTIVIDADE"], src: ["CNT-000012", 1], course: "CRS-001",
    type: "conhecimento", diff: "medio",
    stem: "Qual destes é um desperdício clássico do posto de costura?",
    opts: [
      "Conferir a primeira peça do lote",
      "Procurar ferramenta ou peça várias vezes por hora",
      "Testar a regulagem em retalho",
      "Limpar a máquina no fim do turno",
    ],
    correct: 1,
    why: "Procurar, deslocar-se, retrabalhar, esperar e movimentar a peça além do necessário são desperdícios. Conferir, testar e limpar são investimentos que evitam perdas.",
  },
  {
    n: 56, subject: "Produtividade", comps: ["CMP-PRODUTIVIDADE", "CMP-QUALIDADE"], src: ["CNT-000012", 5], course: "CRS-001",
    type: "interpretacao", diff: "dificil",
    stem: "Por que reduzir defeitos normalmente aumenta a produção?",
    opts: [
      "Porque permite aumentar a velocidade da máquina",
      "Porque devolve à linha o tempo que estava sendo gasto duas vezes na mesma peça",
      "Porque reduz o número de operações da peça",
      "Porque diminui o tempo de cada costura",
    ],
    correct: 1,
    why: "A maior parte do tempo perdido não está na operação, mas no retrabalho, na espera e na procura. Menos defeito devolve esse tempo para a linha.",
  },
];

export const SEED_QUESTIONS: Question[] = SPECS.map(q);
