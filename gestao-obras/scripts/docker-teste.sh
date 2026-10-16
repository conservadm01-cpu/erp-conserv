#!/bin/sh
# Inicialização da VERSÃO DE TESTE (docker-compose.teste.yml). Nunca use em produção:
# carrega dados fictícios de demonstração e gera a chave de criptografia localmente.
set -eu

KEY_FILE=/app/.data/app-key
if [ -z "${APP_ENCRYPTION_KEY:-}" ]; then
  if [ ! -s "$KEY_FILE" ]; then
    node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" > "$KEY_FILE"
    chmod 600 "$KEY_FILE"
  fi
  APP_ENCRYPTION_KEY=$(cat "$KEY_FILE")
  export APP_ENCRYPTION_KEY
fi

echo "[teste] Aplicando migrações..."
npx prisma migrate deploy

echo "[teste] Carregando dados fictícios de demonstração (idempotente)..."
# O seed recusa dados de demonstração em produção; aqui o ambiente é explicitamente de teste.
NODE_ENV=development SEED_MODE=demo npx prisma db seed

echo "[teste] Pronto: acesse ${APP_URL:-http://localhost:3000}"
exec npx next start -p "${PORT:-3000}"
