# Situação do projeto — implementado × pendente

Atualizado ao final da **Fase 1 (fundação executável)**.

## Implementado e testado

### Fundação
- Projeto Next.js 15 + TypeScript estrito, Tailwind, ESLint, Prisma/PostgreSQL.
- Migração versionada inicial, com trigger de imutabilidade da auditoria e restrições adicionais.
- Seed idempotente em dois modos (`demo` com dados fictícios; `base` para produção, com administrador inicial).
- `docker-compose.yml` (PostgreSQL 16 + Mailpit + aplicação opcional), `Dockerfile` multi-stage, `.env.example`.
- Documento OpenAPI 3.1 (`GET /api/openapi`) com teste que garante a documentação de todas as rotas.

### Autenticação (telas 1 e 2)
- Login, logout, recuperação e redefinição de senha por e-mail (adaptadores console/memória/SMTP).
- MFA TOTP obrigatório por papel, cadastro com QR Code, códigos de recuperação, anti-reutilização.
- Troca obrigatória de senha provisória; troca voluntária em "Minha conta".
- Bloqueio por tentativas (conta, IP, MFA), sessões com expiração por inatividade e absoluta, revogação automática.

### Estrutura organizacional (tela 4)
- Tipos de unidade e regras de subordinação configuráveis (tabela `org_unit_type`).
- Criar, editar, mover (com atualização das descendentes), inativar/reativar com justificativa; contatos autorizados; endereço.

### Usuários, papéis e permissões (telas 23 e 24)
- Cadastro de usuários com lotação e senha provisória; bloqueio/inativação/reativação com justificativa; redefinição de MFA.
- Atribuição de papéis por unidade (com ou sem subordinadas) e revogação imediata.
- Matriz de permissões por papel; criação de papéis; papéis de sistema protegidos.
- Anti-escalonamento, segregação (ninguém altera o próprio acesso), proteção do último administrador.

### Auditoria (tela 22)
- Eventos de login/falhas, alterações de cadastro, permissões, situações, consultas à trilha.
- Cadeia de hash, verificação de integridade pela interface, filtros e paginação, acesso restrito por escopo.

### Painel (tela 3, parcial)
- Indicadores reais da Fase 1: unidades por tipo, usuários por situação, usuários sem MFA, falhas/negativas em 24 h — todos do banco e restritos ao escopo.

### Testes
- Unidade: autorização, criptografia, senha, TOTP, higienização, CSRF, redirecionamento seguro, OpenAPI.
- Integração (PostgreSQL real): isolamento entre regiões, autenticação, MFA, recuperação de senha, auditoria, papéis.
- E2E (Playwright, build de produção): fluxos de login, CSP, isolamento na interface e na API, cadastro de MFA, criação de unidade, auditoria, anti-escalonamento, layout em celular.

## Pendente (próximas fases)

| Fase | Itens |
| --- | --- |
| 2 — Obras e documentos | Cadastro de obras com código único e máquina de estados validada no servidor; etapas; escopo de acesso por obra; repositório documental com upload privado (armazenamento de objetos compatível com S3, URLs temporárias, hash), versionamento e aprovação; matriz configurável de requisitos/NRs (regras pendentes de validação por padrão); caixa de aprovação central com segregação de funções; primeiro relatório PDF. |
| 3 — Segurança e pessoas | Profissionais, voluntários (classificação de vínculos), empresas e contratos; EPIs (catálogo, CA, estoque, entregas); equipamentos; inspeções e checklists; riscos; ações corretivas; incidentes; alertas internos e por e-mail. |
| 4 — Gestão e implantação | Cronograma com linha de base e dependências; orçamento, medições e aditivos; painel consolidado com filtros; relatórios PDF completos; alçadas e fluxos configuráveis; atendimento a titulares; ancoragem externa do hash de auditoria; testes de segurança adicionais; service worker (uso offline). |

Telas da lista original ainda não implementadas: 5–21, 25 e 26.

## Limitações conhecidas da Fase 1

- Rate limit geral em memória (por instância) — ver `seguranca.md`.
- Instalação no celular via manifesto (PWA); sem modo offline ainda.
- Nenhuma regra institucional ou normativa foi cadastrada: papéis de exemplo são apenas ponto de partida técnico.
