import type { ContentItem } from "../../core/types";
import { buildContent, type ContentDraft } from "./helpers";

// Continuação do Banco de Conhecimento (ver contents.ts).

const DRAFTS: ContentDraft[] = [
  {
    id: "CNT-000007",
    title: "Silk Screen — da tela à cura",
    description: "Manual de estamparia em silk screen: preparo da tela, emulsão, gravação, registro, rodo, tinta, cura e limpeza.",
    category: "estamparia",
    subcategory: "silk",
    level: "intermediario",
    sector: "Estamparia",
    jobFunction: "Estampador / Estampadora",
    contentType: "manual",
    author: "Luciana Gomes de Araújo — Estamparia",
    sourceType: "pdf",
    reference: "manual-silk-conserv-v2.pdf",
    librarySourceIds: ["SRCLIB-CONSERV-POP", "SRCLIB-SENAI-VEST"],
    keywords: ["silk", "tela", "emulsão", "gravação", "registro", "rodo", "tinta", "cura", "limpeza"],
    competencies: ["CMP-SILK-TELA", "CMP-SILK-IMPRESSAO", "CMP-QUALIDADE"],
    version: "2.0",
    date: "2025-07-14",
    text: `No silk screen a tinta passa através de uma tela onde apenas a área do desenho está aberta. Tudo o que dá certo ou errado na estampa começa na preparação dessa tela.

A tela é formada por um quadro e um tecido de poliéster com uma determinada contagem de fios por centímetro, chamada mesh. Malha com mesh baixo deixa passar mais tinta e serve para tinta encorpada e cobertura em tecido escuro; mesh alto deixa passar menos tinta e serve para detalhe fino e meio-tom. Antes de emulsionar, a tela precisa estar desengordurada e seca: gordura de mão é a causa mais comum de falha de adesão da emulsão.

A emulsão é a camada fotossensível aplicada nos dois lados da tela, em ambiente com luz controlada, e seca no escuro. Camada irregular gera borda serrilhada no desenho e vazamento de tinta.

A gravação expõe a tela à luz com o fotolito posicionado sobre ela. O tempo de exposição depende da lâmpada, da distância e da espessura da emulsão, e precisa ser testado e registrado. Subexposição faz a emulsão sair durante a revelação e a estampa perder área; superexposição fecha detalhes finos que não abrem na revelação.

O registro é o alinhamento entre as cores da estampa e a posição da estampa na peça. Estampa fora de registro aparece como sombra deslocada entre cores ou desenho torto em relação à gola. Na ConServ, a posição padrão para estampa frontal de camiseta é medida a partir da costura do ombro e do centro da peça, conforme a ficha técnica do produto.

O rodo empurra a tinta através da tela. O ângulo, a pressão e a velocidade determinam a quantidade de tinta depositada. Pressão excessiva espalha a tinta além do desenho e mancha a peça; pressão insuficiente deixa falha de cobertura. Duas passadas leves cobrem melhor que uma passada forte.

A cura é o que fixa a tinta. Cada tinta tem uma temperatura e um tempo definidos pelo fabricante, e é a temperatura da película de tinta, não a do ar da estufa, que precisa ser atingida. Tinta mal curada racha, desbota e sai na lavagem — o defeito aparece no cliente, não na fábrica. Registrar temperatura e tempo por lote é parte do processo.

A limpeza da tela logo após o uso preserva o desenho e o tecido da tela. Tinta seca dentro da malha entope o desenho e obriga a regravação. A recuperação da tela usa produtos químicos que exigem EPI, ventilação e descarte correto — nunca despejar resíduo químico na rede comum.

Segurança e saúde na estamparia: use luva e óculos na manipulação de produtos de recuperação e limpeza, mantenha o ambiente ventilado, siga a ficha de segurança de cada produto e nunca misture produtos diferentes. Prensa e estufa trabalham quentes: sinalize, use luva térmica e não improvise apoio.`,
  },
  {
    id: "CNT-000008",
    title: "Embalagem e Expedição — conferência, dobra e identificação",
    description: "Procedimento de embalagem: conferência final, padrão de dobra, quantidade, etiqueta, lote, embalagem e expedição.",
    category: "embalagem",
    subcategory: "procedimento",
    level: "basico",
    sector: "Embalagem e Expedição",
    jobFunction: "Auxiliar de Embalagem",
    contentType: "procedimento",
    author: "Cleide Nascimento Barros — Embalagem",
    sourceType: "docx",
    reference: "pop-embalagem-v3.docx",
    librarySourceIds: ["SRCLIB-CONSERV-POP"],
    keywords: ["embalagem", "dobra", "conferência", "etiqueta", "lote", "expedição", "quantidade"],
    competencies: ["CMP-EMBALAGEM", "CMP-QUALIDADE", "CMP-5S"],
    version: "3.0",
    date: "2025-06-30",
    text: `A embalagem é o último posto da fábrica e o primeiro contato do cliente com a peça. O que passar daqui não tem mais revisão: sai como está.

A conferência final verifica quatro coisas antes de qualquer dobra: se a peça é do modelo e da cor da ordem, se o tamanho da etiqueta é o mesmo da peça, se não há fio solto, mancha ou defeito visível e se as etiquetas internas estão presentes e legíveis.

A dobra segue o padrão do produto e do cliente. Dobra fora do padrão muda a altura da pilha, desalinha a apresentação e, em pedidos com embalagem individual, faz a peça não caber corretamente no saco. O gabarito de dobra existe para que todas as peças saiam iguais, independentemente de quem dobrou.

A quantidade por embalagem e por caixa é definida na ordem de produção. Contagem por estimativa é a origem mais comum de divergência na conferência do cliente. Conte, registre e confira o total ao fechar a caixa.

A identificação é o que liga a caixa ao pedido. Cada embalagem deve trazer modelo, cor, tamanho, quantidade e lote; cada caixa deve trazer a identificação do pedido e o número de caixas do total, no formato caixa X de Y. Sem essa informação, o cliente não consegue conferir e a devolução vem inteira.

O lote acompanha a peça desde o corte. Quando o cliente aponta um problema, é o lote que permite descobrir onde e quando a peça foi produzida e se outras peças do mesmo grupo precisam ser verificadas. Apagar ou trocar a informação de lote na embalagem quebra essa rastreabilidade.

Roteiro de embalagem:
1. Confira a ordem de produção e o padrão de dobra do produto.
2. Inspecione a peça: modelo, cor, tamanho, etiquetas, acabamento.
3. Dobre conforme o gabarito.
4. Embale na quantidade especificada.
5. Identifique embalagem e caixa com modelo, cor, tamanho, quantidade e lote.
6. Registre a quantidade no controle de expedição.
7. Separe para expedição, empilhando conforme o limite de altura e de peso.

Cuidados de ergonomia e segurança na expedição: caixa pesada se levanta com as pernas e com a carga próxima ao corpo, nunca girando o tronco; empilhamento acima da linha dos ombros exige escada ou ajuda; corredor e saída de emergência ficam sempre livres; peça no chão é peça perdida e risco de queda.`,
  },
  {
    id: "CNT-000009",
    title: "Ergonomia no posto de costura",
    description: "Material educativo sobre ajuste do posto, postura, pausas, iluminação e prevenção de lesões no trabalho de costura.",
    category: "ergonomia",
    subcategory: "posto",
    level: "basico",
    sector: "Todos",
    contentType: "manual",
    author: "SESMT / Coordenação de Treinamento",
    sourceType: "pdf",
    reference: "ergonomia-posto-costura-v1.pdf",
    librarySourceIds: ["SRCLIB-MTE-NR17", "SRCLIB-CONSERV-POP"],
    keywords: ["ergonomia", "postura", "cadeira", "altura", "pausa", "iluminação", "LER", "alcance"],
    competencies: ["CMP-ERGONOMIA", "CMP-NR1", "CMP-PRODUTIVIDADE"],
    version: "1.1",
    date: "2026-02-10",
    text: `Ergonomia é adaptar o trabalho à pessoa, e não a pessoa ao trabalho. No posto de costura isso significa ajustar cadeira, mesa, iluminação, alcance e ritmo de forma que a operadora consiga trabalhar o turno inteiro sem dor.

O ajuste da cadeira é o primeiro passo e é individual. Os pés devem ficar apoiados no chão ou em apoio para os pés, os joelhos em ângulo próximo de noventa graus, o quadril mais alto que os joelhos e as costas apoiadas no encosto. Cadeira alta demais faz a operadora apoiar o peso nas coxas; cadeira baixa demais faz levantar os ombros para alcançar a mesa.

A altura da mesa em relação à cadeira define a posição dos ombros. Se os ombros ficam elevados durante a costura, a mesa está alta ou a cadeira está baixa. Ombro elevado por horas é a origem de dor cervical e de tendinite.

O alcance dos materiais deve respeitar a zona de trabalho: o que é usado a cada peça fica dentro do alcance dos antebraços, sem esticar o braço e sem girar o tronco. Girar o tronco repetidamente para pegar peça de uma caixa no chão é um movimento que se repete centenas de vezes por turno.

A iluminação precisa ser suficiente sobre o ponto de costura, sem ofuscamento e sem sombra da própria mão. Costurar tecido escuro com iluminação insuficiente aumenta o esforço visual, a inclinação do pescoço e o número de defeitos não percebidos.

As pausas curtas distribuídas ao longo do turno são mais eficazes que uma pausa longa no fim. Levantar, mudar de posição, alongar punho, pescoço e ombros e olhar para longe por alguns segundos reduz a fadiga acumulada.

Sinais de alerta que devem ser comunicados: formigamento nas mãos, dor que continua depois do turno, perda de força ao segurar, dor no ombro ao levantar o braço, dor lombar ao final do dia. Comunicar cedo permite ajustar o posto antes de virar afastamento.

Ajustes que a própria operadora pode fazer:
1. Regular a cadeira antes de começar o turno.
2. Aproximar a caixa de peças para dentro da zona de alcance.
3. Usar apoio para os pés quando necessário.
4. Ajustar a luminária para iluminar o ponto de costura sem sombra.
5. Alternar micropausas de alongamento entre lotes.

Ajustes que dependem da liderança e da manutenção: altura de bancada, troca de cadeira danificada, iluminação do setor, dispositivo de apoio, rodízio de atividade e revisão de meta quando a tarefa exige postura desfavorável. Este material é educativo e não substitui a avaliação ergonômica formal nem a orientação do serviço de saúde e segurança da empresa.`,
  },
  {
    id: "CNT-000010",
    title: "Cultura ConServ — A camiseta que saiu da ConServ",
    description: "Material de cultura organizacional: a jornada da peça pela fábrica e a influência de cada profissional no resultado final.",
    category: "cultura",
    subcategory: "historia",
    level: "basico",
    sector: "Todos",
    contentType: "apostila",
    author: "Coordenação de Treinamento",
    sourceType: "texto",
    librarySourceIds: ["SRCLIB-CONSERV-CULTURA"],
    keywords: ["cultura", "orgulho", "responsabilidade", "cliente", "equipe", "qualidade", "jornada"],
    competencies: ["CMP-CULTURA", "CMP-COMUNICACAO", "CMP-QUALIDADE"],
    version: "1.0",
    date: "2025-05-05",
    text: `Toda peça que sai da ConServ passou pela mão de muita gente. A camiseta que alguém vai vestir no aniversário do filho, no primeiro dia de trabalho ou no uniforme da empresa começou como um rolo de malha encostado na parede do almoxarifado.

No corte, alguém conferiu a largura do tecido, deixou a malha relaxar, enfestou sem tensão e respeitou o sentido do fio. Se essa pessoa tivesse pressa, a camiseta torceria na primeira lavagem — e ninguém saberia dizer por quê.

Na preparação, alguém separou as partes, conferiu o lote e manteve juntas as peças que precisam ser da mesma tonalidade. Um pacote trocado aqui vira uma camiseta com a frente de um tom e as costas de outro.

Na estamparia, alguém mediu a posição da estampa a partir do ombro, ajustou a pressão do rodo e conferiu a temperatura da cura. Se a cura falhar, o desenho sai na lavagem, na casa do cliente, meses depois.

Na costura, alguém escolheu a agulha certa, testou a regulagem em retalho, conferiu a primeira peça e só então produziu as outras. Essa pessoa evitou um retrabalho que ninguém vai saber que existiu — e é exatamente esse o trabalho bem feito.

Na revisão, alguém olhou a peça com o olho de quem vai comprar, e não com o olho de quem quer terminar. Na embalagem, alguém dobrou no padrão, conferiu a quantidade e identificou o lote, para que o pedido chegue conferindo com a nota.

Nenhuma dessas etapas aparece na camiseta. O que aparece é o conjunto. É por isso que a qualidade não é responsabilidade de um setor: ela é a soma de decisões pequenas tomadas por pessoas que sabem o que estão fazendo.

Os valores que sustentam esse resultado são simples de dizer e exigentes de viver: respeito pelo colega e pelo trabalho dele; responsabilidade pelo que sai da sua mão; cuidado com máquina e material, que são o patrimônio que garante o emprego de todos; limpeza e organização, que são parte do ofício e não tarefa extra; pontualidade, porque a linha depende de todos; comunicação, porque problema escondido sempre custa mais caro do que problema falado.

Orgulho profissional não é fazer bonito quando alguém está olhando. É saber, ao fim do turno, que a peça que você entregou está do jeito que você gostaria de receber.`,
  },
  {
    id: "CNT-000011",
    title: "Sequência operacional da camiseta básica",
    description: "Roteiro de montagem da camiseta básica de malha: ordem das operações, máquinas utilizadas e pontos de conferência.",
    category: "costura",
    subcategory: "sequencia",
    level: "basico",
    sector: "Costura",
    jobFunction: "Costureira / Costureiro",
    contentType: "ficha_tecnica",
    author: "Patrícia Almeida Souza — Produção",
    sourceType: "docx",
    reference: "sequencia-camiseta-basica.docx",
    librarySourceIds: ["SRCLIB-CONSERV-POP", "SRCLIB-SENAI-VEST"],
    keywords: ["sequência", "camiseta", "ombro", "gola", "manga", "lateral", "barra", "revisão"],
    competencies: ["CMP-SEQ-OPERACIONAL", "CMP-OVERLOQUE", "CMP-GALONEIRA", "CMP-QUALIDADE"],
    version: "1.2",
    date: "2025-04-16",
    text: `A sequência operacional é a ordem em que as operações de montagem acontecem. Ela não é uma preferência: mudar a ordem pode tornar uma operação impossível ou obrigar a costurar em espaço fechado, o que gera defeito e perda de tempo.

Sequência padrão da camiseta básica na ConServ:
1. Corte: partes conferidas, identificadas e separadas por lote.
2. Preparação: separação das partes, conferência de tamanho e cor, envio do pacote completo.
3. Fechamento de ombro na overloque, com fita de reforço quando especificado na ficha técnica.
4. Aplicação da gola: fechar a gola, marcar o centro das costas, distribuir o decote e pregar com overloque.
5. Pregar a manga aberta na cava, distribuindo a folga conforme a marcação.
6. Fechar a lateral e a manga em uma única operação contínua, do punho até a barra.
7. Barra da manga e barra da peça na galoneira.
8. Revisão: medidas, pontos, acabamento e limpeza de fios.
9. Embalagem: dobra padrão, identificação e contagem.

O ombro é fechado antes da gola porque a gola precisa de um decote contínuo para ser distribuída. Pregar a gola com o ombro aberto desalinha o centro e produz decote assimétrico.

A manga é pregada aberta antes de fechar a lateral porque, com a lateral fechada, a cava vira um tubo estreito e a costura passa a ser feita em espaço apertado, com alto risco de torcer e de prender a peça.

Cada operação tem um ponto de conferência. No ombro, o alinhamento e a largura da costura. Na gola, a distribuição e o centro das costas. Na manga, a folga distribuída e o casamento de lateral. Na barra, a regularidade e a largura. Na revisão, a medida contra a tabela da ficha técnica.

A primeira peça de cada lote é uma peça de conferência: ela é montada, medida e avaliada antes de o lote ser liberado. Esse hábito custa alguns minutos e evita o retrabalho de um lote inteiro.

Quando surgir um problema no meio do lote, a regra é parar, avisar e não seguir produzindo peça com defeito conhecido. Produzir cem peças erradas é sempre mais caro do que parar dez minutos.`,
  },
  {
    id: "CNT-000012",
    title: "Produtividade — método, ritmo e desperdício de movimento",
    description: "Material sobre produtividade na costura: método de trabalho, organização do posto, desperdícios e relação entre tempo e qualidade.",
    category: "produtividade",
    subcategory: "metodo",
    level: "intermediario",
    sector: "Costura",
    contentType: "apostila",
    author: "Patrícia Almeida Souza — Produção",
    sourceType: "pptx",
    reference: "produtividade-metodo.pptx",
    librarySourceIds: ["SRCLIB-CONSERV-POP", "SRCLIB-SENAI-VEST"],
    keywords: ["produtividade", "método", "movimento", "desperdício", "meta", "tempo", "ritmo", "qualidade"],
    competencies: ["CMP-PRODUTIVIDADE", "CMP-5S", "CMP-QUALIDADE", "CMP-ERGONOMIA"],
    version: "1.0",
    date: "2025-03-22",
    text: `Produtividade não é trabalhar mais rápido: é eliminar o que não precisa ser feito. Duas pessoas com a mesma habilidade e a mesma máquina produzem quantidades diferentes quando uma delas gasta metade do turno procurando, levantando, virando e reorganizando.

Os desperdícios mais comuns no posto de costura são: procurar ferramenta ou peça; deslocar-se para pegar material que poderia estar ao alcance; retrabalhar peça com defeito; esperar pacote, linha ou manutenção; movimentar a peça mais vezes do que a operação exige; produzir além do pedido; e estoque parado entre postos.

O método é a forma combinada de fazer a operação: como a peça chega, como é pegada, por onde entra na máquina, como sai e onde é depositada. Método definido é o que permite que duas pessoas façam a mesma operação do mesmo jeito, com o mesmo tempo e a mesma qualidade.

A economia de movimento segue princípios simples: manter as duas mãos ocupadas de forma útil, evitar movimentos longos quando um curto resolve, posicionar material na sequência em que será usado, usar gravidade e calhas quando possível e eliminar a necessidade de olhar para procurar.

O ritmo sustentável é aquele que pode ser mantido do início ao fim do turno sem queda de qualidade. Ritmo excessivo no começo do dia produz fadiga, aumento de defeito e queda de produção no fim — o total do dia é menor, não maior.

Tempo e qualidade não são inimigos. A maior parte do tempo perdido em uma linha não está na operação: está no retrabalho, na espera e na procura. Reduzir defeito quase sempre aumenta a produção, porque devolve à linha o tempo que estava sendo gasto duas vezes na mesma peça.

Para acompanhar a produtividade de forma justa, é preciso comparar o mesmo modelo, a mesma operação e as mesmas condições de máquina e material. Meta sem método é pressão; meta com método é combinado.

Perguntas que ajudam a melhorar um posto:
1. Quantas vezes a peça é pega e solta nesta operação?
2. O que a operadora procura mais de uma vez por hora?
3. Qual espera acontece todo dia neste posto?
4. Qual defeito aparece com mais frequência e o que o causa?
5. O que poderia ser preparado antes para o posto não parar?`,
  },
];

export const SEED_CONTENTS_PART2: ContentItem[] = DRAFTS.map((d) => buildContent(d, "EMP-0009"));
