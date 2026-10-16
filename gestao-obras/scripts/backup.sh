#!/usr/bin/env sh
# Backup lógico do PostgreSQL (formato custom, compactado).
# Uso: DATABASE_URL=... ./scripts/backup.sh [diretorio]
set -eu
DIR="${1:-backups}"
mkdir -p "$DIR"
URL="${DATABASE_URL%%\?*}"   # remove parâmetros como ?schema=public
FILE="$DIR/obras-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --format=custom --no-owner --no-privileges --file="$FILE" "$URL"
sha256sum "$FILE" > "$FILE.sha256"
echo "Backup gerado: $FILE"
