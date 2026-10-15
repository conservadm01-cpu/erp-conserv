# Backup no Windows (PowerShell) usando o pg_dump do contêiner Docker.
# Uso: .\scripts\backup.ps1
$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path backups | Out-Null
$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$file = "obras-$stamp.dump"
docker compose exec -T db pg_dump -U obras -d obras --format=custom --no-owner --no-privileges -f "/tmp/$file"
docker compose cp "db:/tmp/$file" "backups/$file"
docker compose exec -T db rm "/tmp/$file"
(Get-FileHash "backups/$file" -Algorithm SHA256).Hash | Out-File "backups/$file.sha256"
Write-Host "Backup gerado: backups/$file"
