#!/usr/bin/env bash
#
# Boot smoke test completo (G4 do ADR-003 v2): valida que o `start.mjs`
# real sobe contra Postgres real, valida schema, e o Next standalone
# responde 200 em /api/health. Pega bugs runtime do start.mjs (foi o
# que faltou no PR #143 e fez o site cair).
#
# Pre-requisito: build foi feito (.next/standalone existe).
# Service container: postgres:16 disponivel em localhost:5432.

set -e

if [ -z "$DATABASE_URL" ]; then
  echo "::error::DATABASE_URL nao setada."
  exit 1
fi

if [ ! -d ".next/standalone" ]; then
  echo "::error::.next/standalone nao existe. Rode 'npx next build' primeiro."
  exit 1
fi

# Aplica migrations no Postgres efemero (start.mjs nao aplica mais)
echo "1/5: aplicando migrations no Postgres efemero..."
npx prisma migrate deploy

# Recria standalone runtime layout que o Dockerfile produz
# (cd .next/standalone com static + public + scripts disponiveis)
echo ""
echo "2/5: preparando runtime layout (mimicar Dockerfile)..."
mkdir -p .next/standalone/scripts
cp scripts/start.mjs .next/standalone/scripts/start.mjs
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
[ -d public ] && cp -r public .next/standalone/public

# Sobe o app em background
echo ""
echo "3/5: subindo Next via start.mjs em background (porta 3001)..."
cd .next/standalone

NODE_ENV=production \
PORT=3001 \
HOSTNAME=0.0.0.0 \
DATABASE_URL="$DATABASE_URL" \
node scripts/start.mjs > /tmp/boot-smoke.log 2>&1 &

APP_PID=$!
trap "kill $APP_PID 2>/dev/null || true" EXIT

# Aguarda boot (max 60s)
echo ""
echo "4/5: aguardando /api/health responder 200 (max 60s)..."
SUCCESS=0
for i in $(seq 1 30); do
  sleep 2
  # Checa se processo ainda existe
  if ! kill -0 $APP_PID 2>/dev/null; then
    echo "::error::start.mjs morreu antes do healthcheck. Logs:"
    cat /tmp/boot-smoke.log
    exit 1
  fi

  if curl -sf -m 3 http://localhost:3001/api/health > /tmp/health.json 2>/dev/null; then
    echo "  Boot OK apos ${i} tentativas (~$((i * 2))s)"
    SUCCESS=1
    break
  fi
done

if [ $SUCCESS -ne 1 ]; then
  echo "::error::Timeout esperando /api/health. Logs:"
  cat /tmp/boot-smoke.log
  exit 1
fi

echo ""
echo "5/5: validando resposta de /api/health..."
cat /tmp/health.json
if grep -q '"status":"ok"' /tmp/health.json; then
  echo "  Status OK"
else
  echo "::error::Health retornou mas status != ok"
  exit 1
fi

echo ""
echo "OK: boot smoke test passou"
