# Arquitetura

## Visão geral

Aplicação monolítica modular em Next.js (App Router), com renderização no
servidor e uma API REST interna. O mesmo processo serve telas e API; a camada
de serviços concentra as regras e a autorização, e é usada tanto pelas páginas
(Server Components) quanto pelos Route Handlers.

```
Navegador ──HTTPS──▶ middleware (CSP/nonce, correlation-id, redireciona sem cookie)
                       │
          ┌────────────┴─────────────┐
   Páginas (Server Components)   Route Handlers /api/**
          │  requirePageActor()        │  publicRoute / partialRoute / authedRoute
          │                            │  (Origin, sessão, estado MFA, erros)
          └────────────┬─────────────┘
                 services/*.service.ts   ← autorização por escopo + regras + auditoria
                       │
                 Prisma ORM ──▶ PostgreSQL (trigger de imutabilidade da auditoria)
```

## Camadas

| Camada | Pasta | Responsabilidade |
| --- | --- | --- |
| Interface | `src/app`, `src/components` | Telas, formulários, estados de carregamento/erro/vazio. Nunca é a barreira de segurança. |
| Transporte | `src/server/http` | Sessão, verificação de origem, leitura/validação de entrada, mapeamento de erros, correlation-id. |
| Domínio | `src/server/services` | Regras de negócio, autorização (`assertCan`), transações e auditoria. |
| Validação | `src/server/validation` | Esquemas Zod compartilhados. |
| Dados | Prisma + `prisma/` | Modelo, migrações, seed. |

## Autorização por escopo

- Cada unidade tem um **caminho materializado** (`path`), por exemplo
  `/<central>/<região>/<congregação>/`.
- Um usuário recebe **papéis em unidades** (`UserScope`). A permissão vale na
  unidade e, se `includeDescendants`, em todas as subordinadas.
- Verificação: `can(ator, permissão, caminhoDaUnidade)` — prefixo de caminho.
- Listagens usam `pathWhere()`, que vira um filtro `startsWith` no banco: o
  dado fora do escopo nunca é carregado.
- Recurso fora do escopo responde **404**, para não revelar existência.
- Os escopos são relidos a cada requisição: concessões e revogações valem na hora.
- Anti-escalonamento: só se concede um papel cujas permissões o concedente já
  possui naquela unidade; ninguém altera o próprio acesso; papéis globais só
  são editados por quem tem `role.manage` na raiz.

## Sessão e estados de autenticação

`OK`, `MFA_PENDENTE`, `MFA_CADASTRO_OBRIGATORIO`, `TROCA_SENHA_OBRIGATORIA`.
Somente `OK` acessa a área autenticada; os demais só alcançam as rotas da
etapa correspondente (`partialRoute`).

## Auditoria

Tabela `audit_event` somente inclusão: trigger no banco bloqueia UPDATE,
DELETE e TRUNCATE; cada registro guarda `prev_hash` e `hash`
(SHA-256 do anterior + conteúdo canônico), serializado por
`pg_advisory_xact_lock`. A verificação recalcula a cadeia e aponta o primeiro
registro divergente. Eventos de negócio são gravados **na mesma transação** da
operação.

## Decisões registradas

Ver [`adr/`](adr/).
