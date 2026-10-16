# Restauração no Windows em um banco NOVO (obras_restore) para teste.
# Uso: .\scripts\restore.ps1 backups\obras-AAAAMMDDTHHMMSSZ.dump
param([Parameter(Mandatory = $true)][string]$File)
$ErrorActionPreference = "Stop"
$name = Split-Path $File -Leaf
docker compose cp $File "db:/tmp/$name"
docker compose exec -T db psql -U obras -d postgres -c "DROP DATABASE IF EXISTS obras_restore;" -c "CREATE DATABASE obras_restore;"
docker compose exec -T db pg_restore -U obras -d obras_restore --no-owner --no-privileges --exit-on-error "/tmp/$name"
docker compose exec -T db rm "/tmp/$name"
Write-Host "Restaurado em obras_restore. Confira com: docker compose exec db psql -U obras -d obras_restore -c 'SELECT count(*) FROM audit_event;'"
