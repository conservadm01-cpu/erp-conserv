# Backup e restauração

## O que é copiado

Todo o banco PostgreSQL (estrutura, dados, triggers da auditoria). Arquivos
enviados (a partir da Fase 2) ficarão no armazenamento de objetos e terão
procedimento próprio.

## Linux / servidor (pg_dump instalado)

```bash
DATABASE_URL="postgresql://usuario:senha@host:5432/obras" ./scripts/backup.sh backups
# gera backups/obras-AAAAMMDDTHHMMSSZ.dump e o .sha256 correspondente
```

Restauração **sempre em banco vazio** (nunca sobre o banco em uso):

```bash
createdb obras_restore
DATABASE_URL="postgresql://usuario:senha@host:5432/obras_restore" ./scripts/restore.sh backups/obras-XXXX.dump
```

## Windows (Docker Desktop)

```powershell
.\scripts\backup.ps1
.\scripts\restore.ps1 backups\obras-XXXX.dump   # restaura em obras_restore
```

## Teste de restauração (fazer mensalmente)

1. Restaurar o último backup em `obras_restore`.
2. Conferir contagens: `SELECT count(*) FROM app_user; SELECT count(*) FROM audit_event;`
3. Verificar a integridade da auditoria no banco restaurado:
   ```bash
   DATABASE_URL="postgresql://.../obras_restore" npx tsx -e 'import {verifyAuditChain} from "./src/server/audit/audit"; verifyAuditChain().then(r=>{console.log(r);process.exit(0)})'
   ```
   O resultado deve ser `{ ok: true, ... }`.
4. Registrar data, responsável e resultado.

> Este procedimento foi executado no ambiente de desenvolvimento durante a
> Fase 1: backup e restauração reproduziram as mesmas contagens, os triggers
> de imutabilidade e uma cadeia de auditoria íntegra.

## Política sugerida (a validar)

- Backup diário completo, retenção de 30 dias; mensal com retenção de 12 meses.
- Cópia fora do provedor principal; backups cifrados em repouso.
- Em serviços gerenciados, habilitar também PITR (recuperação a um ponto no tempo).
