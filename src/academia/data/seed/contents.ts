import type { ContentItem } from "../../core/types";
import { buildContent, type ContentDraft } from "./helpers";

// =====================================================================
// BANCO DE CONHECIMENTO CONSERV — carga inicial
// ---------------------------------------------------------------------
// Estes são materiais técnicos da própria ConServ, já em texto. Quando o
// administrador envia um PDF/DOCX/PPTX pelo painel, o arquivo percorre
// exatamente o mesmo caminho: extração → chunks → SOURCE_ID → análise.
// Nada aqui é "texto fixo de tela": é DADO, e é a fonte rastreável de
// aulas, questões, curiosidades, desafios e jogos.
// =====================================================================

const DRAFTS: ContentDraft[] = [
  {
    id: "CNT-000001",
    title: "Regulagem da Overloque",
    description: "Manual interno de regulagem da máquina overloque: tensão, comprimento do ponto, diferencial, faca e pressão do calcador.",
    category: "costura",
    subcategory: "regulagem",
    level: "intermediario",
    sector: "Costura",
    jobFunction: "Costureira / Costureiro",
    contentType: "manual",
    author: "Sebastião Ferreira Rocha — Manutenção",
    sourceType: "pdf",
    reference: "manual-regulagem-overloque-v2.pdf",
    librarySourceIds: ["SRCLIB-JUKI", "SRCLIB-CONSERV-POP"],
    keywords: ["overloque", "tensão", "diferencial", "comprimento do ponto", "faca", "calcador", "franzido"],
    competencies: ["CMP-OVERLOQUE", "CMP-REGULAGEM", "CMP-QUALIDADE"],
    version: "2.0",
    date: "2025-11-18",
    text: `A overloque é a máquina responsável por fechar e arrematar a borda do tecido ao mesmo tempo em que a faca aparar o excesso. Em malha, ela é a máquina que mais influencia o caimento da peça, porque trabalha com o tecido em movimento e pode alongar ou franzir a costura conforme estiver regulada.

A tensão é a força com que cada fio é puxado durante a formação do ponto. Na overloque existem tensores independentes para a agulha esquerda, a agulha direita (quando houver), o looper superior e o looper inferior. Quando a tensão da agulha está alta demais, a costura fica dura, a linha marca o tecido e a peça tende a franzir; quando está baixa demais, o ponto fica frouxo, abre ao esticar e deixa o tecido aparecendo entre as laçadas.

O comprimento do ponto é a distância entre uma laçada e a próxima, medida em milímetros. Na ConServ, o padrão para malha de algodão é entre 2,5 mm e 3,0 mm. Ponto muito curto sobrecarrega o tecido, esquenta a agulha e pode furar a malha; ponto muito longo reduz a resistência da costura e deixa a borda com aspecto aberto.

O diferencial é o mecanismo que controla a diferença de velocidade entre o dente de transporte dianteiro e o traseiro. Com diferencial maior que 1, o tecido é empurrado e a costura tende a encolher, o que serve para evitar barriga em gola e em recorte de malha leve. Com diferencial menor que 1, o tecido é esticado, o que serve para tecidos que encolhem na costura. Uma pequena alteração no diferencial muda visivelmente o comportamento da malha, por isso ele deve ser ajustado em retalho do mesmo tecido antes de iniciar o lote.

A pressão do calcador mantém o tecido apoiado contra os dentes de transporte. Pressão excessiva marca a malha e atrapalha o diferencial; pressão insuficiente faz o tecido escapar, gerando ponto irregular e falha de arremate.

A faca da overloque deve aparar o excesso de tecido exatamente na largura da costura especificada na ficha técnica. Faca desalinhada ou sem corte deixa fio solto na borda, o que aparece na revisão como defeito de acabamento. A troca e o ajuste da faca são tarefas da manutenção: o operador deve parar a máquina e solicitar apoio.

Roteiro de verificação quando a costura está franzindo:
1. Confira o diferencial e teste em retalho do mesmo tecido.
2. Reduza a tensão da linha da agulha em pequenos passos, testando a cada ajuste.
3. Verifique a pressão do calcador.
4. Confira se a agulha é a correta para a malha e se não está cega ou torta.
5. Se o franzido continuar, pare a máquina e chame a manutenção.

Roteiro de verificação quando o ponto está pulando:
1. Troque a agulha — agulha cega, torta ou de ponta errada é a causa mais comum.
2. Confira se a agulha está no fundo do cabeçote e com a canaleta voltada para o lado correto.
3. Verifique o passamento da linha, tensor por tensor, com o calcador levantado.
4. Observe se a linha está presa em alguma guia ou no porta-carretel.
5. Persistindo, pare a máquina e chame a manutenção: pode ser sincronismo de looper.

Antes de iniciar qualquer lote, faça a costura de teste em retalho do mesmo tecido, estique a costura com as duas mãos e confira se o ponto acompanha sem arrebentar e se a borda está limpa. Esse teste de trinta segundos evita retrabalho em centenas de peças.`,
  },
  {
    id: "CNT-000002",
    title: "Agulhas e Linhas: escolha correta por tecido",
    description: "Ficha técnica de seleção de agulha (ponta e numeração) e de linha (título e composição) por tipo de tecido e operação.",
    category: "costura",
    subcategory: "insumos",
    level: "basico",
    sector: "Costura",
    jobFunction: "Costureira / Costureiro",
    contentType: "ficha_tecnica",
    author: "Coordenação de Treinamento",
    sourceType: "pdf",
    reference: "ficha-agulhas-linhas-v3.pdf",
    librarySourceIds: ["SRCLIB-GROZ", "SRCLIB-COATS", "SRCLIB-CONSERV-POP"],
    keywords: ["agulha", "linha", "ponta esférica", "ball point", "título", "numeração", "malha", "plano"],
    competencies: ["CMP-AGULHA-LINHA", "CMP-RETA", "CMP-QUALIDADE"],
    version: "3.0",
    date: "2025-10-02",
    text: `A agulha é a peça mais barata da máquina e a que causa os defeitos mais caros. Ela define se o fio vai entrar no tecido abrindo espaço entre os fios ou rompendo o fio do tecido. Trocar a agulha é a primeira verificação diante de ponto pulando, furo na malha e linha arrebentando.

A ponta esférica, conhecida como ball point, afasta os fios da malha em vez de cortá-los. Por isso ela é obrigatória em malha: ponta cortante em malha abre furinhos que aparecem depois da primeira lavagem, quando a peça já está no cliente. A ponta aguda, ou sharp, é usada em tecido plano, onde o fechamento firme da trama exige penetração direta.

A numeração da agulha indica a espessura do corpo. Na escala métrica, 70 equivale a 0,70 mm e 90 equivale a 0,90 mm. Quanto mais fino o tecido, mais fina a agulha. Na ConServ, malha leve de 30.1 usa agulha 70 ou 75 de ponta esférica; malha média usa 80; malha pesada, moletom e tecido plano médio usam 90.

A linha precisa ter resistência compatível com a costura e espessura compatível com a agulha. Linha grossa em agulha fina esquenta, desfia e arrebenta; linha fina em agulha grossa deixa o ponto frouxo e marcado. O título da linha indica a sua espessura: quanto maior o número do título no sistema Nm, mais fina é a linha. Para malha, a linha 120 de poliéster texturizado no looper dá elasticidade ao arremate da overloque.

Regras práticas da casa:
1. Troque a agulha no início de cada lote grande e sempre que ouvir um estalo diferente na penetração.
2. Agulha que caiu no chão vai para o recipiente de descarte, nunca de volta à máquina.
3. Nunca lixe, dobre ou tente endireitar uma agulha.
4. Confira a ponta da agulha contra a luz antes de instalar; ponta com rebarba corta a malha.
5. Use sempre a mesma marca e referência especificadas na ficha técnica do produto.

A relação entre agulha, linha e tecido aparece na qualidade final de quatro formas: furo na malha, ponto pulando, linha arrebentando e costura marcada. Em todos os quatro casos, verificar agulha e linha antes de mexer na regulagem economiza tempo e evita desregular uma máquina que estava correta.

O descarte de agulhas quebradas segue o procedimento de resíduos: recipiente rígido identificado, nunca no lixo comum, porque agulha solta fere quem manuseia o resíduo.`,
  },
  {
    id: "CNT-000003",
    title: "NR-1 — Conceitos fundamentais, GRO e PGR",
    description: "Conteúdo educativo sobre a Norma Regulamentadora nº 1: direitos e deveres, perigo e risco, identificação e avaliação de riscos, GRO, PGR, inventário de riscos e plano de ação.",
    category: "seguranca",
    subcategory: "nr-1",
    level: "basico",
    sector: "Todos",
    contentType: "norma",
    author: "Coordenação de Treinamento / SESMT",
    sourceType: "pdf",
    reference: "material-educativo-nr1-v1.pdf",
    url: "https://www.gov.br/trabalho-e-emprego/pt-br",
    librarySourceIds: ["SRCLIB-MTE-NR1", "SRCLIB-MTE-NR12", "SRCLIB-MTE-NR17"],
    keywords: ["NR-1", "GRO", "PGR", "perigo", "risco", "inventário de riscos", "plano de ação", "quase acidente", "psicossocial"],
    competencies: ["CMP-NR1", "CMP-PERIGO-RISCO", "CMP-EMERGENCIA", "CMP-PSICOSSOCIAL"],
    version: "1.2",
    date: "2026-01-15",
    text: `A NR-1 é a Norma Regulamentadora que estabelece as disposições gerais e o gerenciamento de riscos ocupacionais aplicáveis às demais normas de segurança e saúde no trabalho. Ela organiza o que a empresa deve fazer para conhecer, avaliar e controlar os riscos do ambiente, e o que cada trabalhador deve fazer no dia a dia. Este material é educativo: a aplicação específica deve ser tratada com o responsável técnico da empresa e com a leitura do texto oficial publicado pelo Ministério do Trabalho e Emprego.

Perigo é a fonte com potencial de causar lesão ou agravo à saúde. Risco é a combinação entre a probabilidade de acontecer e a gravidade do que pode acontecer. Uma faca de corte sem proteção é um perigo; a chance de alguém se cortar e a gravidade desse corte formam o risco. Essa diferença é a base de todo o restante: primeiro se identifica o perigo, depois se avalia o risco.

O GRO, Gerenciamento de Riscos Ocupacionais, é o processo contínuo de identificar perigos, avaliar riscos, definir medidas de prevenção, acompanhar a eficácia e revisar quando algo muda. Não é um documento: é um ciclo que não termina.

O PGR, Programa de Gerenciamento de Riscos, é a forma como esse gerenciamento fica documentado. Ele se sustenta em dois documentos: o inventário de riscos, que registra os perigos identificados, os riscos avaliados e quem está exposto, e o plano de ação, que registra o que será feito, por quem, até quando e como será verificado se funcionou.

A identificação de perigos olha para o trabalho como ele realmente acontece. Na confecção, os perigos mais comuns aparecem em máquinas com partes móveis, agulhas e facas, movimentação de fardos e caixas, ruído, calor em prensas e estufas, produtos químicos de estamparia e limpeza, eletricidade, piso escorregadio, iluminação insuficiente, postura mantida por longos períodos e repetitividade de movimento.

As medidas de prevenção seguem uma ordem de prioridade: primeiro eliminar o perigo, depois reduzir na fonte, depois reduzir pela organização do trabalho, depois usar medidas administrativas ou de sinalização e, por último, equipamento de proteção individual. O EPI é a última barreira e não substitui as anteriores.

Direitos e deveres andam juntos. O trabalhador tem direito a informação clara sobre os riscos do seu trabalho, a medidas de prevenção, a treinamento e a participar do processo por meio de seus representantes. O trabalhador tem o dever de cumprir as orientações de segurança, usar corretamente o EPI fornecido, zelar pela sua segurança e pela dos colegas, colaborar com a empresa e comunicar situações de risco ao superior imediato.

O quase acidente é o evento que poderia ter causado lesão, mas não causou. Ele é a informação mais barata que existe em segurança: mostra uma falha real sem ninguém se machucar. Na ConServ, quase acidente deve ser comunicado do mesmo jeito que o acidente, sem busca de culpado.

Os fatores de risco psicossociais relacionados ao trabalho tratam de como a organização do trabalho afeta a saúde: ritmo e metas, jornada e pausas, clareza do que é esperado, relação com a liderança e com a equipe, autonomia, reconhecimento, comunicação e situações de assédio ou violência. Eles entram no mesmo ciclo de gerenciamento de riscos dos demais fatores.

A comunicação de riscos é obrigação da empresa e direito do trabalhador, e funciona em duas direções: a empresa informa os riscos e as medidas, e o trabalhador informa o que vê no posto. Situações de emergência exigem conduta treinada: interromper a atividade em segurança, acionar o alarme ou a liderança, seguir a rota de fuga até o ponto de encontro e não retornar antes da liberação.

Na prática do dia a dia, a cultura de segurança aparece em gestos pequenos: parar a máquina antes de retirar resíduo, não improvisar proteção, avisar quando algo está diferente, manter corredor livre, registrar o que viu. Segurança não é uma campanha: é o jeito de trabalhar.`,
  },
  {
    id: "CNT-000004",
    title: "Enfesto, Risco e Corte — Procedimento Padrão ConServ",
    description: "POP do setor de corte: preparação da mesa, enfesto sem tensão, sentido do fio, encaixe, aproveitamento, corte, identificação e separação de lotes.",
    category: "corte",
    subcategory: "procedimento",
    level: "intermediario",
    sector: "Corte",
    jobFunction: "Cortador / Cortadora",
    contentType: "procedimento",
    author: "Antônio Carlos Pereira — Corte",
    sourceType: "docx",
    reference: "pop-corte-v4.docx",
    librarySourceIds: ["SRCLIB-CONSERV-POP", "SRCLIB-SENAI-VEST", "SRCLIB-MTE-NR12"],
    keywords: ["enfesto", "risco", "sentido do fio", "encaixe", "aproveitamento", "desperdício", "lote", "identificação"],
    competencies: ["CMP-ENFESTO", "CMP-RISCO-ENCAIXE", "CMP-CORTE-MAQUINA", "CMP-APROVEITAMENTO"],
    version: "4.1",
    date: "2025-09-12",
    text: `O enfesto é a sobreposição ordenada de folhas de tecido sobre a mesa de corte, formando um colchão com altura controlada, para que todas as folhas sejam cortadas ao mesmo tempo com a mesma medida. A qualidade de tudo o que vem depois começa aqui: um enfesto com tensão ou desalinhado produz peças fora de medida que nenhuma costura consegue corrigir.

O desperdício de tecido começa muitas vezes antes do corte. Ele nasce no encaixe mal resolvido, na largura de tecido não conferida, no enfesto refeito, na emenda de peça perdida e na falta de conferência do risco. Cada centímetro de sobra multiplicado pelo número de folhas vira metro no fim do mês.

O sentido do fio é a direção dos fios do tecido em relação ao molde. Na malha, o sentido da coluna de malha corresponde ao comprimento da peça. Peça cortada fora do sentido do fio torce na lavagem, estica na lateral e muda o caimento. A seta do molde indica o sentido e não pode ser ignorada para ganhar aproveitamento.

O risco é o desenho do conjunto de moldes na largura útil do tecido, na sequência de tamanhos planejada. O encaixe é a forma de organizar esses moldes para usar o mínimo de tecido possível respeitando o sentido do fio, as margens e os pares simétricos.

Procedimento padrão:
1. Confira a ordem de produção, a ficha técnica e a grade de tamanhos.
2. Meça a largura útil real do rolo e compare com a largura usada no risco.
3. Deixe o tecido relaxar depois de desenrolado antes de enfestar; malha enrolada sob tensão encolhe na mesa.
4. Enfeste alinhando ourela com ourela, sem esticar e sem deixar barriga, conferindo a altura máxima do colchão.
5. Posicione e confira o risco: sentido do fio, quantidade de peças por tamanho, pares simétricos e margens.
6. Grampeie ou pese o risco para não deslocar durante o corte.
7. Corte com a máquina apoiada, acompanhando o traço, sem forçar a curva.
8. Identifique imediatamente cada pacote com ordem de produção, tamanho, cor, lote e quantidade.
9. Separe por lote e encaminhe para a preparação, registrando a saída.
10. Registre sobras aproveitáveis e resíduo, conforme o controle de aproveitamento.

A identificação é o que impede a mistura de lotes. Tecido da mesma cor em lotes diferentes pode ter tonalidade levemente distinta: se as partes de uma mesma peça vierem de lotes diferentes, a diferença aparece na peça pronta e gera devolução. Por isso o pacote identificado viaja junto com as partes até a embalagem.

Segurança no corte: a máquina de corte vertical tem proteção de lâmina que nunca deve ser removida ou amarrada; a luva de malha de aço é obrigatória na mão de apoio; a máquina deve ser desligada da energia para troca de lâmina e qualquer ajuste interno, tarefa exclusiva da manutenção. Resíduo de tecido no chão, perto da mesa, é risco de queda e deve ser recolhido durante o turno, não apenas no fim.`,
  },
  {
    id: "CNT-000005",
    title: "Inspeção de Qualidade — Defeitos mais comuns em malha",
    description: "Guia de revisão: classificação de defeitos, causa provável, ação imediata e critério de aprovação ou retrabalho.",
    category: "qualidade",
    subcategory: "inspecao",
    level: "intermediario",
    sector: "Qualidade",
    jobFunction: "Revisor(a) de Qualidade",
    contentType: "procedimento",
    author: "Rafael Moreira Lima — Qualidade",
    sourceType: "pdf",
    reference: "guia-defeitos-malha-v2.pdf",
    librarySourceIds: ["SRCLIB-CONSERV-POP", "SRCLIB-ABNT-ISO9001"],
    keywords: ["defeito", "revisão", "retrabalho", "ponto pulando", "franzido", "medida", "gola", "barra", "tonalidade"],
    competencies: ["CMP-QUALIDADE", "CMP-DEFEITOS", "CMP-RETRABALHO"],
    version: "2.3",
    date: "2025-12-05",
    text: `A revisão não existe para reprovar peças: existe para devolver informação à produção antes que o mesmo defeito se repita em todo o lote. Uma peça reprovada que não gera informação é dinheiro perdido duas vezes.

Defeito de costura aberta ou ponto pulando aparece como falha na sequência de pontos. A causa mais provável é agulha cega, torta ou de ponta errada, seguida de passamento de linha incorreto e de sincronismo de máquina. A ação imediata é separar a peça, avisar o posto de origem e verificar a agulha antes de liberar a continuidade do lote.

Costura franzida em malha geralmente vem de diferencial inadequado, tensão alta da linha da agulha ou pressão excessiva do calcador. Em gola e em recorte de malha leve, o franzido também aparece quando a peça é puxada pela operadora durante a costura, em vez de ser conduzida.

Medida fora do especificado é verificada com a tabela de medidas da ficha técnica e a tolerância definida para o produto. Quando a medida está fora em toda a amostra, o problema normalmente está antes da costura: enfesto com tensão, corte fora do traço ou molde desatualizado.

Diferença de tonalidade entre partes da mesma peça indica mistura de lotes de tecido. A ação é localizar o pacote, conferir a identificação e bloquear o lote até o corte confirmar a origem.

Gola torta ou com barriga relaciona-se à distribuição do decote, ao diferencial e à ordem de fechamento. A barra ondulada relaciona-se à tensão da galoneira, ao diferencial e à condução da peça.

Fio solto, ponta de linha longa e resíduo de linha são defeitos de acabamento. Eles parecem pequenos, mas são os que o cliente final percebe primeiro, porque aparecem na peça dobrada na prateleira.

Critério de decisão na revisão:
1. Defeito que compromete uso, resistência ou medida: peça reprovada, destino conforme a classificação do produto.
2. Defeito de acabamento recuperável: retrabalho imediato e reinspeção.
3. Defeito repetido em mais de uma peça da mesma amostra: parar, comunicar o posto e investigar a causa antes de liberar.
4. Dúvida sobre o critério: não adivinhe, chame a supervisão.

Todo defeito registrado deve ter posto de origem, tipo de defeito e causa provável. Esse registro é o que permite ver, no fim da semana, que metade do retrabalho de um mês veio de uma única causa evitável, por exemplo agulha trocada fora do prazo.

A melhor inspeção é a que a própria operadora faz na primeira peça: conferir medida, ponto e acabamento antes de produzir as outras noventa e nove. Isso se chama autocontrole e é mais barato que qualquer revisão no fim da linha.`,
  },
  {
    id: "CNT-000006",
    title: "5S aplicado ao posto de costura",
    description: "Apostila interna dos cinco sensos aplicados ao posto, com exemplos de antes e depois na fábrica.",
    category: "organizacao",
    subcategory: "5s",
    level: "basico",
    sector: "Todos",
    contentType: "apostila",
    author: "Coordenação de Treinamento",
    sourceType: "pptx",
    reference: "apostila-5s-conserv.pptx",
    librarySourceIds: ["SRCLIB-CONSERV-POP", "SRCLIB-SENAI-VEST"],
    keywords: ["5S", "organização", "limpeza", "padronização", "disciplina", "posto de trabalho", "movimento"],
    competencies: ["CMP-5S", "CMP-PRODUTIVIDADE", "CMP-ERGONOMIA"],
    version: "1.4",
    date: "2025-08-20",
    text: `O 5S é um método de organização do trabalho formado por cinco sensos que se apoiam um no outro: utilização, organização, limpeza, padronização e disciplina. Na confecção, ele não é decoração: é tempo, qualidade e segurança.

O primeiro senso, utilização, separa o que serve do que não serve. No posto de costura, sobra tesoura sem corte, caixa vazia, retalho antigo, carretel de linha de ordem encerrada e ferramenta que não é da máquina. O que não serve sai do posto; o que serve fica onde a mão alcança.

O segundo senso, organização, define um lugar para cada coisa conforme a frequência de uso. O que é usado a cada peça fica ao alcance da mão sem girar o tronco; o que é usado a cada lote fica ao alcance de um passo; o que é usado raramente fica no armário do setor. Uma bancada organizada reduz movimentos desnecessários e, com isso, reduz cansaço e tempo por peça.

O terceiro senso, limpeza, trata de limpar e, principalmente, de descobrir por que sujou. Poeira de fiapo na máquina não é só estética: fiapo acumulado no transportador e no ponto de laçada causa ponto irregular e trava mecanismo. Limpar a máquina no fim do turno é manutenção de primeiro nível, e é tarefa do operador.

O quarto senso, padronização, transforma o que funcionou em regra visível: marcação no lugar das caixas, etiqueta no armário, quadro com a sequência operacional do modelo, ponto definido para peça aprovada e para peça de retrabalho. Padrão que só existe na cabeça de uma pessoa desaparece quando ela falta.

O quinto senso, disciplina, é manter o padrão quando ninguém está olhando e corrigir o desvio no momento em que ele aparece. Ele se sustenta por hábito e por liderança presente, não por cartaz.

Sinais de que o 5S está caindo no setor:
1. Caixa de peça pronta ocupando corredor de passagem.
2. Retalho e fiapo acumulados embaixo da máquina.
3. Ferramentas trocadas entre postos sem retorno ao lugar.
4. Peça de retrabalho misturada com peça aprovada.
5. Postos com pilhas que escondem a bancada.

Cada um desses sinais tem efeito direto: corredor obstruído é risco de queda e de atraso na evacuação; fiapo é defeito de costura; ferramenta perdida é tempo parado; peça misturada é retrabalho em dobro ou peça com defeito chegando ao cliente.

O 5S começa por um posto, não pela fábrica inteira. Escolher um posto, organizar com quem trabalha nele, registrar o antes e o depois e combinar quem mantém é mais eficaz do que uma campanha geral que dura duas semanas.`,
  },
];

export const SEED_CONTENTS_PART1: ContentItem[] = DRAFTS.map((d) => buildContent(d, "EMP-0009"));
