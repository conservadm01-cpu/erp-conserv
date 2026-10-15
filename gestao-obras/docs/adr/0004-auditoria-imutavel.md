# ADR 0004 — Auditoria append-only com cadeia de hash

**Situação:** aceita (Fase 1)

**Decisão.** Trigger PostgreSQL bloqueia UPDATE/DELETE/TRUNCATE em
`audit_event`; cada registro encadeia o hash do anterior; em produção a
aplicação usa um papel de banco sem privilégio de alterar a tabela
(`prisma/sql/producao-papeis.sql`).

**Limites conhecidos.** O dono das tabelas pode desativar o trigger; a cadeia
de hash permite **detectar** (não impedir) essa adulteração. Para proteção
contra quem controla o servidor de banco, recomenda-se exportar periodicamente
o último hash para armazenamento externo (WORM) — previsto para a Fase 4.
