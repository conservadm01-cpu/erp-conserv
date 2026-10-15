# Gestão de Obras

Aplicação web responsiva (instalável no celular) para gestão de obras com
abrangência nacional, múltiplas regiões e unidades locais.

> **Proposta técnica independente.** Este software não representa normas,
> procedimentos, alçadas ou estruturas oficiais de nenhuma instituição. Toda
> regra institucional é configurável e deve ser validada pelos responsáveis
> autorizados antes do uso com dados reais.

**Situação atual: Fases 1 a 4 concluídas** — fundação (autenticação com MFA,
hierarquia organizacional, permissões por escopo, auditoria imutável), obras e
documentos (máquina de estados, repositório documental privado e versionado,
matriz de requisitos/NRs, aprovação central, dossiê em PDF), segurança e pessoas
(profissionais, voluntários, empresas, contratos, EPIs, equipamentos, inspeções,
ações corretivas, alertas) e gestão (cronograma com linha de base, diário de
obra, orçamento por versões, despesas, medições, alçadas por valor
configuráveis, painel consolidado, catálogo de relatórios em PDF, atendimento a
titulares e parâmetros). Veja o que está pronto e o que falta em
[`docs/situacao.md`](docs/situacao.md).

## Tecnologias e versões

| Componente | Versão |
| --- | --- |
| Node.js | 22 LTS |
| Next.js (App Router) / React | 15.5.28 / 19.1.10 |
| TypeScript | 5.9.3 |
| PostgreSQL | 16 |
| Prisma ORM | 6.19.3 |
| Zod | 3.25.76 |
| Tailwind CSS | 3.4.19 |
| Vitest / Playwright | 3.2.4 / 1.56.1 |
| bcryptjs / otplib (TOTP) | 3.0.3 / 12.0.1 |
| PDFKit (relatórios) | 0.17.2 |
| AWS SDK S3 (armazenamento opcional) | 3.999.0 |

Versões fixadas em `package.json` e `package-lock.json`.

## Estrutura de pastas

```
gestao-obras/
├─ prisma/
│  ├─ schema.prisma          # modelo de dados
│  ├─ migrations/            # migrações versionadas (inclui trigger da auditoria)
│  ├─ seed.ts, seed-data.ts  # dados iniciais / demonstração (fictícios)
│  └─ sql/producao-papeis.sql# separação de papéis do banco em produção
├─ src/
│  ├─ app/                   # telas (App Router) e API (app/api/**/route.ts)
│  │  ├─ (auth)/             # login, MFA, recuperação e troca de senha
│  │  └─ (app)/              # área autenticada (painel, organização, usuários…)
│  ├─ components/            # componentes reutilizáveis de interface
│  ├─ lib/                   # utilitários do navegador (cliente da API, formatação)
│  ├─ middleware.ts          # CSP com nonce, correlation-id, redirecionamento
│  └─ server/                # código exclusivo do servidor
│     ├─ auth/               # senha, sessão, MFA, contexto de páginas
│     ├─ authz/              # catálogo de permissões e autorização por escopo
│     ├─ audit/              # trilha de auditoria encadeada por hash
│     ├─ http/               # wrapper das rotas, erros, rate limit
│     ├─ mail/               # adaptadores de e-mail (console, memória, SMTP)
│     ├─ services/           # regras de domínio (toda autorização acontece aqui)
│     ├─ validation/         # esquemas Zod
│     └─ openapi.ts          # documentação da API (GET /api/openapi)
├─ tests/
│  ├─ unit/                  # testes de unidade
│  ├─ integration/           # testes com PostgreSQL real (isolamento, auth, auditoria)
│  └─ e2e/                   # Playwright (navegador)
├─ scripts/                  # backup/restauração e recriação do banco de testes
├─ docs/                     # arquitetura, ADRs, LGPD, segurança, implantação
├─ docker-compose.yml, Dockerfile, .env.example
```

## Instalação no Windows (passo a passo)

1. **Instale os pré-requisitos**
   - [Node.js 22 LTS](https://nodejs.org/) (marque a opção de adicionar ao PATH).
   - [Docker Desktop](https://www.docker.com/products/docker-desktop/) (com WSL 2 habilitado, conforme o instalador indicar).
   - [Git para Windows](https://git-scm.com/download/win).
2. **Abra o PowerShell** e obtenha o código:
   ```powershell
   git clone <URL-do-repositorio>
   cd <repositorio>\gestao-obras
   ```
3. **Configure o ambiente:**
   ```powershell
   Copy-Item .env.example .env
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
   Abra o `.env` no Bloco de Notas e cole o valor gerado em `APP_ENCRYPTION_KEY`.
4. **Suba o banco e a caixa de e-mail local:**
   ```powershell
   docker compose up -d
   ```
5. **Instale as dependências, crie as tabelas e carregue os dados fictícios:**
   ```powershell
   npm install
   npm run db:migrate
   npm run db:seed
   ```
6. **Inicie em modo de desenvolvimento:**
   ```powershell
   npm run dev
   ```
   Acesse <http://localhost:3000>.

### Usuários de demonstração (fictícios)

Senha de todos: `Demo@Obras2026!`

| E-mail | Papel | Escopo |
| --- | --- | --- |
| admin@exemplo.test | Administrador do sistema | Gestão central (exige MFA) |
| gestor.norte@exemplo.test | Gestor regional | Região Demonstração Norte (exige MFA) |
| gestor.sul@exemplo.test | Gestor regional | Região Demonstração Sul (exige MFA) |
| auditor@exemplo.test | Auditor | Gestão central (exige MFA) |
| analista@exemplo.test | Analista da gestão central | Gestão central (exige MFA) — analisa documentos e decide aprovações |
| seguranca.norte@exemplo.test | Técnico de segurança | Região Demonstração Norte (exige MFA) |
| consulta.alfa@exemplo.test | Consulta | Unidade Local Alfa |

No primeiro acesso de perfis com MFA, o sistema pede o cadastro de um
aplicativo autenticador TOTP (por exemplo, os autenticadores da Google, Microsoft
ou equivalentes de código aberto).

### E-mails (recuperação de senha)

- Padrão (`MAIL_DRIVER=console`): a mensagem e o link aparecem no terminal onde roda `npm run dev`.
- Para ver numa caixa de e-mail local: no `.env` use `MAIL_DRIVER=smtp`, `SMTP_HOST=localhost`, `SMTP_PORT=1025` e abra <http://localhost:8025> (Mailpit).

## Linux / macOS

Os mesmos comandos funcionam, trocando `Copy-Item` por `cp`. Sem Docker, use um
PostgreSQL 16 local e ajuste `DATABASE_URL`.

### Fluxo de uma obra (demonstração)

1. Entre como `gestor.norte@exemplo.test`, abra **Obras → Nova obra**, cadastre e envie documentos.
2. Use os botões de situação: *Enviar solicitação → Iniciar triagem → Enviar para aprovação*.
3. Entre como `analista@exemplo.test`, abra **Aprovações**, registre o parecer e decida.
4. Na obra, baixe o **dossiê em PDF**.
5. Ainda como gestor, na aba **Orçamento**, elabore o orçamento, inclua linhas e
   submeta; o analista aprova em **Aprovações**. Depois registre uma medição e
   lançamentos. Acompanhe em **Orçamentos** e no **Painel**.
6. Use as abas **Cronograma** (dependências, marcos, linha de base) e **Diário**.
7. Em **Relatórios**, gere qualquer relatório do catálogo em PDF.

Por segregação de funções, quem solicita não aprova a própria solicitação, e
quem envia um arquivo não o analisa.

### Arquivos enviados

Por padrão ficam em `.data/storage` (fora da pasta pública). Para usar um
armazenamento compatível com S3, veja as variáveis `STORAGE_*` e `S3_*` no
`.env.example`; o `docker-compose.yml` tem um MinIO opcional (`--profile s3`).
Downloads usam sempre links temporários vinculados ao usuário.

### Rotina diária

`npm run jobs:daily` marca como vencidos os documentos com validade expirada e
gera os alertas (documentos, qualificações, integração de segurança, inspeções e
ações atrasadas, etapas atrasadas, obras paradas, aprovações pendentes, estoque
de EPI e equipamentos com inspeção/manutenção vencida). Alertas e itens críticos
também são enviados por e-mail pelo adaptador configurado. A mesma rotina
aplica a retenção configurada em **Configurações → Parâmetros** (tentativas de
login e sessões encerradas) e o alerta de desvio orçamentário.
Agende-a uma vez por dia (no Windows, pelo Agendador de Tarefas).

## Banco de dados e migrações

| Ação | Comando |
| --- | --- |
| Aplicar migrações pendentes | `npm run db:migrate` |
| Criar nova migração (desenvolvimento) | `npm run db:migrate:dev -- --name descricao` |
| Carregar dados iniciais/demonstração | `npm run db:seed` |
| Recriar o banco local do zero (apaga dados) | `npm run db:reset` |

## Testes

Os testes de integração e E2E usam bancos próprios (`obras_test` e
`obras_e2e_test`), recriados automaticamente a cada execução. Por segurança, o
script recusa apagar qualquer banco cujo nome não termine em `_test`.

```powershell
npm run typecheck          # verificação de tipos
npm run lint               # ESLint
npm run test               # unidade + integração (exige o PostgreSQL ativo)
npx playwright install chromium   # apenas na primeira vez
npm run test:e2e           # ponta a ponta no navegador (gera build de produção)
```

## Backup e restauração

Veja [`docs/backup.md`](docs/backup.md). Resumo no Windows:

```powershell
.\scripts\backup.ps1                                   # gera backups\obras-<data>.dump
.\scripts\restore.ps1 backups\obras-<data>.dump        # restaura em obras_restore (teste)
```

## API

Documento OpenAPI 3.1 em `GET /api/openapi`. Requisições de alteração exigem
cabeçalho `Origin` igual ao da aplicação (proteção CSRF). Erros seguem o
formato `{ "error": { "code", "message", "details", "correlationId" } }`.

## Produção

Veja [`docs/implantacao.md`](docs/implantacao.md) — inclui HTTPS, separação de
papéis do banco (`prisma/sql/producao-papeis.sql`), seed em modo `base`,
backups e checklist de segurança.

## Documentação

- [Arquitetura](docs/arquitetura.md) e [decisões (ADRs)](docs/adr/)
- [Segurança](docs/seguranca.md)
- [LGPD e proteção de dados](docs/lgpd.md)
- [Backup e restauração](docs/backup.md)
- [Implantação em produção](docs/implantacao.md)
- [Situação: implementado × pendente](docs/situacao.md)
