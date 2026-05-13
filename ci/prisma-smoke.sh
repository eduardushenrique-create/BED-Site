#!/usr/bin/env bash
#
# Boot smoke minimo (parte de G4 do ADR-003 v2): valida que o Prisma
# client compilado pelo build atual:
#   1. Instancia sem lancar (cobre o bug de `new PrismaClient()` sem
#      options que quebrou o PR #143)
#   2. Conecta ao Postgres real
#   3. Roda migrations idempotentemente
#   4. Faz uma query simples em Order
#
# NAO roda o Next inteiro. Boot test completo (com `start.mjs` + curl
# em /api/health) fica para PR futuro — exige tunning de paths de
# .next/standalone que extrapola escopo deste PR.

set -e

if [ -z "$DATABASE_URL" ]; then
  echo "::error::DATABASE_URL nao setada. Smoke precisa de Postgres real."
  exit 1
fi

echo "1/4: aplicando migrations..."
npx prisma migrate deploy

echo ""
echo "2/4: gerando Prisma client (idempotente apos build)..."
npx prisma generate > /dev/null 2>&1 || true

echo ""
echo "3/4: validando que Prisma client instancia (lib/prisma.ts pattern)..."
node -e "
const { PrismaPg } = require('@prisma/adapter-pg')
const { PrismaClient } = require('@prisma/client')
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) { console.error('DATABASE_URL ausente no node check'); process.exit(1) }
const client = new PrismaClient({ adapter: new PrismaPg(databaseUrl) })
client.\$connect()
  .then(() => { console.log('  Prisma client conectou OK'); return client.\$disconnect() })
  .catch(err => { console.error('  Prisma falhou:', err.message); process.exit(1) })
"

echo ""
echo "4/4: query basica em Order..."
node -e "
const { PrismaPg } = require('@prisma/adapter-pg')
const { PrismaClient } = require('@prisma/client')
const client = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL) })
client.order.count()
  .then(n => { console.log('  Order.count() =', n); return client.\$disconnect() })
  .catch(err => { console.error('  query falhou:', err.message); process.exit(1) })
"

echo ""
echo "OK: smoke do Prisma client passou"
