# Gestão de Obras — convenções

Proposta técnica independente: **nunca** inventar normas, alçadas ou regras
oficiais de instituições. Regras institucionais são dados configuráveis,
desativadas/pendentes até validação.

## Comandos
- `npm run typecheck` · `npm run lint` · `npm run test` (unidade + integração, PostgreSQL real em `obras_test`) · `npm run test:e2e`
- Migração nova: `npx prisma migrate dev --name <nome> --create-only`, revisar o SQL e aplicar com `npx prisma migrate deploy`.
- O banco de testes é recriado a cada execução; o script recusa bancos cujo nome não termine em `_test`.

## Arquitetura
- Rotas em `src/app/api/**/route.ts` são finas: `authedRoute`/`partialRoute`/`publicRoute` + `readJson(schema)` + chamada de serviço.
- Regras e **toda autorização** em `src/server/services/*`, usando `assertCan`/`can`/`pathWhere` com o caminho materializado da unidade (`path`). Fora do escopo → `Errors.notFound` (404).
- Escrita crítica em `prisma.$transaction`, com `recordAudit(..., meta, tx)` na mesma transação.
- Validação com Zod em `src/server/validation`; mensagens em português.
- Toda rota nova precisa estar em `src/server/openapi.ts` (há teste).
- Permissões novas: adicionar em `src/server/authz/catalog.ts` e em `prisma/seed-data.ts` (papéis de exemplo).
- Não excluir fisicamente registros históricos; usar status.
- UI: componentes em `src/components/ui`; toda tela com carregamento, erro, vazio e confirmação para ações críticas. Sem botões decorativos.
- Testes de integração devem cobrir o isolamento entre regiões de cada módulo novo.
