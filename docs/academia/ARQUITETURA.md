# Academia ConServ — Arquitetura

> **Conhecimento que vira qualidade.**
> Plataforma de capacitação, segurança, qualidade e desenvolvimento
> profissional da ConServ Confecções.

A regra que orienta todo o desenho:

> **CONTEÚDO É DADO, NÃO É CÓDIGO.**
> Quando um PDF novo entra, ninguém programa nada. O sistema recebe,
> interpreta, organiza, sugere, gera, um humano revisa, publica e mede.

---

## 1. Visão de camadas

```
┌──────────────────────────────────────────────────────────────────┐
│ UI            ui/ (primitivos, layout, personagens) + features/   │
│               Nenhuma tela fala com o banco direto.               │
├──────────────────────────────────────────────────────────────────┤
│ ESTADO/ACESSO auth/ (sessão, permissões) · state/ (hooks reativos)│
├──────────────────────────────────────────────────────────────────┤
│ MOTORES       CONTENT · QUIZ · GAME · CERTIFICATE · COMPETENCY    │
│               GAMIFICATION · LEARNING (progresso/adaptativo/posto)│
│               HANDBOOK · NOTIFICATION · AUDIT                      │
├──────────────────────────────────────────────────────────────────┤
│ REPOSITÓRIOS  data/repositories/ — consultas com significado       │
├──────────────────────────────────────────────────────────────────┤
│ BANCO         data/db.ts — banco reativo em memória + persistência │
├──────────────────────────────────────────────────────────────────┤
│ ADAPTADORES   Supabase · window.storage (ERP) · localStorage · mem │
└──────────────────────────────────────────────────────────────────┘
```

Regras de dependência: a UI conhece motores e repositórios; motores
conhecem repositórios; repositórios conhecem o banco; só o banco conhece
o adaptador. Nenhuma seta aponta para cima.

---

## 2. Estrutura de pastas

```
academia.html                 ← entrada da Academia (o ERP segue em index.html)
src/academia/
├── main.tsx · App.tsx         ← entrada + tabela de rotas
├── index.css                  ← design system (Tailwind + tokens + impressão)
├── core/                      ← tipos do domínio, IDs, datas, texto (PT-BR), imagens
│   ├── types.ts               ← TODAS as entidades (seções 22 e 23 do projeto)
│   ├── ids.ts                 ← CNT-000001, SRC:<id>#<trecho>, CSV-XXXX-XXXX
│   └── text.ts                ← tokenização, frases, definições, similaridade
├── data/
│   ├── adapters/              ← Supabase · window.storage · localStorage · memória
│   ├── db.ts                  ← banco reativo (1 requisição; leitura em ordem estável)
│   ├── schema.ts              ← as 33 "tabelas"
│   ├── defaults.ts            ← configurações padrão (XP, níveis, IA, certificado)
│   ├── repositories/          ← catálogo, pessoas, aprendizagem, gamificação, ops
│   └── seed/                  ← carga inicial (conteúdo real da ConServ)
├── engines/
│   ├── content/               ← CONTENT_ENGINE + extratores + analisador + IA
│   ├── quiz/ · game/ · certificate/ · competency/
│   ├── gamification/          ← XP, níveis, badges
│   ├── learning/              ← progresso, adaptativo, "aprender no posto"
│   ├── handbook/              ← gerador de apostilas
│   ├── risk/                  ← registro de risco (com a regra do anonimato)
│   ├── notification/ · audit/
├── auth/                      ← sessão, senha (ponto de troca) e permissões
├── state/                     ← hooks reativos, boot do banco, avisos (toasts)
├── router/                    ← roteador por hash (#/...)
├── ui/                        ← primitivos, layout responsivo, personagens, blocos
├── features/                  ← telas (colaborador e administração)
│   └── admin/AdminArea.tsx    ← área administrativa em pedaço separado (lazy)
├── integrations/erp/          ← contrato da integração com o ERP ConServ
└── __tests__/                 ← integração dos motores + integridade do conteúdo
```

---

## 3. Banco de dados

O protótipo grava no mesmo Supabase do ERP (tabela `app_storage`), com
todas as chaves prefixadas:

```
academia:v1:<coleção>:<id>     ex.: academia:v1:content:CNT-000001
```

As 33 coleções (`data/schema.ts`) correspondem 1:1 às tabelas de um banco
relacional futuro:

| Grupo | Coleções |
|---|---|
| Pessoas | `users`, `employees`, `departments`, `job_roles` |
| Conhecimento | `content`, `content_versions`, `content_sources` |
| Educação | `courses`, `modules`, `lessons`, `learning_paths` |
| Avaliação | `questions`, `quizzes`, `quiz_attempts` |
| Jogos | `games`, `game_sessions`, `challenges`, `challenge_attempts` |
| Competências | `competencies`, `employee_competencies` |
| Progresso | `enrollments`, `progress` |
| Certificação | `certificates`, `certificate_validations` |
| Gamificação | `badges`, `employee_badges`, `xp_transactions` |
| Operação | `handbooks`, `risk_reports`, `notifications`, `audit_logs`, `settings` |

**Como carrega rápido:** `db.load()` faz uma única leitura em lote
(`select key,value where key like 'academia:v1:%'`), monta o cache em
memória e serve a UI de forma síncrona. Cada gravação atualiza o cache na
hora (UI otimista) e persiste em segundo plano.

**Migração para banco relacional:** implementar `KeyValueAdapter` contra a
nova API, ou trocar `data/db.ts` por chamadas REST mantendo a assinatura
dos repositórios. Nada acima muda.

---

## 4. Rastreabilidade: o SOURCE_ID

É a espinha dorsal da confiança do sistema.

```
Material (CNT-000001)
   └── trecho 3  →  SOURCE_ID  "SRC:CNT-000001#3"
                       ├── aula (bloco de texto)
                       ├── questão (sourceRef + excerpt)
                       ├── curiosidade
                       ├── rodada de jogo
                       └── passo do "aprender no posto"
```

Toda informação técnica exibida traz o selo **Fonte**, que abre o trecho
literal do material de origem, o localizador (página/slide/parágrafo) e a
fonte externa vinculada (MTE, SENAI, fabricante…). Itens gerados por
interpretação vêm marcados como **incertos**.

---

## 5. Fluxo do conteúdo (seções 8, 21, 35 e 40)

```
[+ NOVO CONTEÚDO]
      │  PDF · DOCX · PPTX · TXT · imagem · vídeo · URL · texto
      ▼
EXTRAÇÃO (no navegador)         engines/content/extractors
      │  texto + localizador (página 3, slide 2, parágrafo 7)
      ▼
CONTENT_ID + TRECHOS            CNT-000013, SRC:CNT-000013#0..n
      ▼
ANÁLISE                          engines/content/analyzers/HeuristicAnalyzer
      │  conceitos · definições · procedimentos · riscos · exemplos
      │  competências · nível · resumo · avisos
      ▼
SUGESTÕES (nada publicado)       aulas · questões · curiosidades · desafios · jogos
      ▼
REVISÃO HUMANA                   admin seleciona item a item
      ▼
PUBLICAÇÃO                       vira registro real + versão + auditoria
      ▼
MEDIÇÃO                          relatórios, competências, lacunas
```

O status do material acompanha o fluxo:
`draft → processing → pending_review → published` (ou `rejected`/`archived`).

---

## 6. Fluxo da IA (seções 9, 24 e 36)

Dois provedores implementam o mesmo contrato `ContentAnalyzer`:

| Provedor | Onde roda | Quando é usado |
|---|---|---|
| `HeuristicAnalyzer` | navegador, sem rede | padrão — a plataforma funciona inteira sem IA externa |
| `RemoteAiProvider` | API configurada pelo admin | quando há endpoint; **enriquece** a análise local |

Regras que valem para qualquer provedor (aplicadas no código e enviadas
na requisição como `AI_POLICY`):

1. usar somente o conteúdo autorizado;
2. preservar a fonte (SOURCE_ID em cada item);
3. não inventar informação técnica;
4. sinalizar o que é incerto;
5. não virar aconselhamento jurídico nem criar requisito legal inexistente;
6. nada publicado sem revisão humana.

O administrador controla quantidade de questões/aulas/curiosidades/jogos,
nível, tom, público e mistura de dificuldade (Configurações → IA).

**Como o analisador local gera sem inventar:**

| Item gerado | Base no material |
|---|---|
| Aula | trechos verbatim + destaque de definição + alerta de segurança |
| Questão "o que é X" | definição extraída; distratores = definições de outros termos |
| Questão de sequência | passos numerados identificados no procedimento |
| Questão "qual afirmação está correta" | frase real vs. variações com antônimo/número trocado (marcada como incerta) |
| Curiosidade | frase causal/numérica reenquadrada como "Você sabia?" |
| Desafio | frase prescritiva ("deve", "nunca", "pare") + variações |
| Jogo | rodadas montadas com as questões/procedimentos/riscos já extraídos |

---

## 7. Fluxo do quiz

```
prepare(quizId)      sorteia N questões aprovadas + embaralha alternativas
   ▼
execução             uma questão por vez, dá para voltar antes de finalizar
   ▼
submit()             corrige → grava tentativa → XP proporcional + bônus
   ├── evidência de competência por competência da prova (peso = % de acerto)
   ├── assuntos com erro → aprendizado adaptativo
   └── avaliação final aprovada → fecha o curso e emite certificado
```

---

## 8. Fluxo dos jogos

O GAME_ENGINE não conhece "jogos": conhece **mecânicas**.

| Mecânica | Jogos que a usam |
|---|---|
| `diagnosis` | Qual é o defeito? · Salve a Máquina |
| `sequence` | Monte a Camiseta |
| `hotspot` | Caça ao Risco · Mestre da Qualidade |
| `timed_quiz` | Desafio dos 60 Segundos |

Um jogo é um registro com `type`, `payload` e as rodadas. Criar um jogo
novo do mesmo tipo é criar **dado**. Criar um tipo novo é registrar uma
mecânica no motor e um renderizador na UI — os jogos seguem sendo dados.

Ao terminar: grava a partida, pontua (% de acerto), lança XP e registra
evidência de competência.

---

## 9. Fluxo do certificado (seção 13)

```
curso concluído + nota ≥ mínima
      ▼
CERTIFICATE_ENGINE.issue()
      ├── código único CSV-XXXX-XXXX (sem caracteres ambíguos)
      ├── classificação explícita ("conclusão de treinamento interno")
      ├── auditoria
      └── caminho público /validar-certificado/<código>
      ▼
documento imprimível (PDF pelo navegador) com QR Code apontando para a validação
      ▼
/validar-certificado/<código>  → página pública, sem login
      └── registra cada consulta (certificate_validations)
```

O motor **nunca** apresenta o documento como certificação oficial ou
habilitação legal; a classificação é dado configurável pela empresa.

---

## 10. Competências (seção 14)

Cada atividade vira evidência com peso: aula 3 · desafio 5 · jogo 5 ·
quiz 8 · certificado 10 · curso 18 · ERP 12 · avaliação do gestor 30.
A soma (limitada a 100) vira nível:

| Pontuação | Nível |
|---|---|
| ≥ 1 | 1 Conhecimento |
| ≥ 16 | 2 Básico |
| ≥ 38 | 3 Operacional |
| ≥ 62 | 4 Avançado |
| ≥ 82 | 5 Especialista |
| ≥ 96 | 6 Mestre |

A função define o **alvo** de cada competência; a diferença é a **lacuna**,
que alimenta recomendação de curso, painel do gestor e relatórios.

---

## 11. Pontos de troca (o que plugar depois)

| O quê | Onde | Como está hoje |
|---|---|---|
| Banco real | `data/adapters/` | Supabase (chave/valor) — trocar por API/Postgres |
| Storage de arquivos | `core/images.ts`, `ContentItem.source.fileRef` | data URL no registro — trocar por Supabase Storage/S3 |
| Autenticação | `auth/password.ts`, `auth/AuthContext.tsx` | login simples — trocar por Supabase Auth/SSO |
| IA externa | `engines/content/ai/AiProvider.ts` | contrato pronto; endpoint configurável |
| ERP ConServ | `integrations/erp/ErpBridge.ts` | contrato + tradução operação→treinamento |
| OCR de PDF escaneado | `engines/content/extractors/pdf.ts` | avisa o admin para colar o texto |

---

## 12. Segurança e conformidade

- **Permissões** (`auth/permissions.ts`): ADMIN · GESTOR · INSTRUTOR ·
  COLABORADOR. Colaborador nunca altera conteúdo oficial.
- **Auditoria**: criação, análise, aprovação, publicação, rejeição,
  avaliação de competência, emissão/revogação de certificado, conclusão de
  curso, tratamento de risco e alteração de configurações.
- **Versionamento**: quem alterou, quando, o que mudou, fonte e motivo.
- **Privacidade**: ranking é opcional e por adesão; registro de risco pode
  ser anônimo; a ficha do colaborador não guarda dado sensível.
- **Conteúdo normativo**: aviso obrigatório em tela — *"Conteúdo educativo.
  Consulte a legislação e os responsáveis técnicos da empresa para
  aplicação específica."*

---

## 13. Como rodar e verificar

```bash
npm install
npm run dev             # ERP: /  ·  Academia: /academia.html
npm run typecheck       # TypeScript estrito
npm run test:academia   # 93 verificações dos motores + integridade do conteúdo
npm run build           # gera as duas aplicações
npm run build:publicacao# build com caminhos relativos (hospedagem estática)
```

Varredura no navegador (opcional, precisa do Playwright):

```bash
npm i -D playwright && npx playwright install chromium   # uma vez
npm run build && npm run preview                         # num terminal
npm run smoke:academia                                   # noutro terminal
```

A varredura abre todas as telas (computador e celular, colaborador e
administração) procurando erro de JavaScript, tela em branco, rolagem
horizontal, botão sem nome acessível, campo sem rótulo e id repetido;
depois roda os fluxos de ponta a ponta (aula, quiz, jogo, registro de
risco, análise de material novo, **leitura e análise de PDF**) e as
**regressões** já corrigidas — link compartilhado que sobrevive ao login,
perfis de demonstração estáveis, progresso após o F5, impressão da
apostila e do certificado, foco no diálogo e aviso de falha de gravação.

### Leitura de PDF

`engines/content/extractors/pdf.ts` lê o PDF no próprio navegador com o
pdfjs e devolve um trecho por página — é daí que vem o localizador
`página N` que o SOURCE_ID guarda. PDF digitalizado (só imagem) não tem
texto: nesse caso a tela pede para colar o conteúdo, sem fingir que leu.

O pdfjs trabalha num arquivo auxiliar separado (`pdf.worker`). Ele vai
para `assets/` no build normal; para hospedagem estática use
`npm run build:publicacao`, que além dos caminhos relativos reescreve os
bytes de controle crus desse arquivo (publicadores de página os recusam, e
sem o arquivo a leitura de PDF cai fora). A varredura de navegador cobre
esse caminho de ponta a ponta com um PDF gerado na hora.

### Ordem de leitura do banco

`db.list()` devolve a coleção **ordenada por ID**. O armazenamento
(localStorage, Supabase) não garante a ordem das chaves: sem essa
ordenação as listas mudavam de posição a cada recarregamento e um
`slice(0, n)` passava a mostrar outros registros. Quem precisa de outra
ordem (ordem do módulo, data, pontuação) ordena explicitamente no
repositório.
