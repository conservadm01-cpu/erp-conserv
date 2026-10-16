# ADR 0003 — Escopo organizacional por caminho materializado

**Situação:** aceita (Fase 1)

**Decisão.** Cada unidade armazena `path` com os ids de todos os ancestrais.
Autorização e filtros usam comparação de prefixo, indexada no banco. Mover uma
unidade atualiza o caminho dela e das descendentes numa única instrução SQL,
dentro de transação.

**Consequências.** Consultas de escopo simples e rápidas, sem CTE recursiva.
Eventos de auditoria guardam o caminho do momento do fato (imutável); após uma
movimentação, eventos antigos continuam visíveis a quem tinha escopo sobre o
caminho anterior.
