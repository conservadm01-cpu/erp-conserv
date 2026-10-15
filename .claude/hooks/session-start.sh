#!/bin/bash
# Prepara o ambiente de sessões na nuvem: PostgreSQL, bancos, dependências e .env.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
APP="$ROOT/gestao-obras"

# 1. PostgreSQL local
if command -v pg_lsclusters >/dev/null 2>&1; then
  if ! pg_lsclusters -h | awk '{print $4}' | grep -q online; then
    service postgresql start >/dev/null
  fi
  for _ in $(seq 1 30); do
    su postgres -c "psql -tAc 'select 1'" >/dev/null 2>&1 && break
    sleep 1
  done
  su postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='obras'\"" | grep -q 1 \
    || su postgres -c "psql -qc \"CREATE ROLE obras WITH LOGIN PASSWORD 'obras_dev' CREATEDB;\""
  for db in obras obras_test obras_e2e_test obras_shadow; do
    su postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='$db'\"" | grep -q 1 \
      || su postgres -c "psql -qc 'CREATE DATABASE $db OWNER obras;'"
  done
fi

# 2. Dependências do app legado (raiz) e do Gestão de Obras
if [ -f "$ROOT/package.json" ]; then
  (cd "$ROOT" && npm install --no-audit --no-fund >/dev/null)
fi

cd "$APP"
if [ ! -f .env ]; then
  cp .env.example .env
  KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
  sed -i "s|^APP_ENCRYPTION_KEY=\"\"|APP_ENCRYPTION_KEY=\"$KEY\"|" .env
fi
npm install --no-audit --no-fund >/dev/null

# 3. Banco de desenvolvimento com migrações e dados fictícios
npx prisma migrate deploy >/dev/null
npm run -s db:seed >/dev/null

# 4. Navegador do Playwright já instalado no container
if [ -n "${CLAUDE_ENV_FILE:-}" ] && [ -d /opt/pw-browsers ]; then
  echo 'export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers' >> "$CLAUDE_ENV_FILE"
fi

echo "Ambiente pronto: PostgreSQL, dependências e banco 'obras' com dados de demonstração."
