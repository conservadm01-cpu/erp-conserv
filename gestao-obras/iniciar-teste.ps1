# Sobe a VERSÃO DE TESTE (dados fictícios) com Docker Desktop e abre o navegador.
#   Uso:  powershell -ExecutionPolicy Bypass -File .\iniciar-teste.ps1
#   Parar: docker compose -f docker-compose.teste.yml down   (acrescente -v para apagar os dados)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Host "Docker não encontrado. Instale e abra o Docker Desktop: https://www.docker.com/products/docker-desktop/" -ForegroundColor Red
  exit 1
}
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "O Docker Desktop não está em execução. Abra-o, aguarde ficar pronto e rode este script de novo." -ForegroundColor Red
  exit 1
}

Write-Host "Construindo e iniciando (a primeira vez leva alguns minutos)..."
docker compose -f docker-compose.teste.yml up -d --build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Aguardando a aplicação ficar pronta..."
for ($i = 0; $i -lt 90; $i++) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:3000/api/health" -TimeoutSec 3
    if ($r.StatusCode -eq 200) { break }
  } catch { }
  Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "Pronto: http://localhost:3000" -ForegroundColor Green
Write-Host "Senha de todos os usuários de teste: Demo@Obras2026!"
Write-Host "E-mails enviados pelo sistema: http://localhost:8025"
Start-Process "http://localhost:3000"
