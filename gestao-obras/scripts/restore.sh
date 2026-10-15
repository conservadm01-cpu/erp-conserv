#!/usr/bin/env sh
# Restaura um backup em um banco VAZIO (nunca sobre o banco de produção em uso).
# Uso: DATABASE_URL=postgresql://.../obras_restore ./scripts/restore.sh backups/arquivo.dump
set -eu
FILE="$1"
[ -f "$FILE.sha256" ] && sha256sum -c "$FILE.sha256"
URL="${DATABASE_URL%%\?*}"
pg_restore --no-owner --no-privileges --exit-on-error --dbname="$URL" "$FILE"
echo "Restauração concluída em $URL"
