#!/usr/bin/env bash
#
# CR-8 do POSTMORTEM-2026-05-13-deploys.md / G3 do ADR-003 v2:
# bloqueia em CI padroes anti conhecidos no codigo. Cada padrao tem
# origem documentada num incidente real.
#
# Adicionar novos padroes APENAS quando houver incidente que justifique.
# Cada bloco abaixo deve referenciar a memoria/PR que motivou a regra.

set -e

EXIT=0
fail() {
  echo "::error::$1"
  EXIT=1
}

# ---------------------------------------------------------------------------
# 1. `new PrismaClient()` sem options
# ---------------------------------------------------------------------------
# Prisma 7 lanca em runtime quando instanciado sem options — exige
# `adapter: new PrismaPg(databaseUrl)` (vide lib/prisma.ts:15-17).
# Ignorar isso quebrou o boot do PR #143 em 2026-05-13.
# Memoria: feedback_prisma7_client_options.md
#
# EXCECAO TEMPORARIA: scripts/start.mjs ainda tem o pattern legado dentro
# de try/catch silencioso. PR-4 do ADR-003 v2 vai consertar (substituir
# por pg direto). Quando PR-4 mergear, remover esta excecao.
hits=$(grep -rnE 'new[[:space:]]+PrismaClient[[:space:]]*\([[:space:]]*\)' \
  --include="*.ts" --include="*.tsx" --include="*.mjs" --include="*.js" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=ci . 2>/dev/null \
  | grep -v "scripts/start.mjs:" || true)
if [ -n "$hits" ]; then
  echo "$hits" | while IFS= read -r line; do
    fail "PrismaClient() sem options (Prisma 7 lanca; use lib/prisma.ts ou pg direto): $line"
  done
fi

# ---------------------------------------------------------------------------
# 2. COPY node_modules inteiro pro runner image
# ---------------------------------------------------------------------------
# Tentado no PR #136 em 2026-05-13: imagem ~500MB extra estourou algum
# limite do Railway, derrubou o site por +13min mesmo com revert dos PRs
# subsequentes. Solucao cirurgica: copiar APENAS @prisma/* e libs que
# de fato sao usadas em runtime.
# Memoria: project_railway_dockerfile_limits.md
hits=$(grep -nE 'COPY[[:space:]]+--from=builder[[:space:]]+/app/node_modules[[:space:]]+\./node_modules' \
  Dockerfile 2>/dev/null || true)
if [ -n "$hits" ]; then
  fail "Dockerfile: COPY node_modules inteiro pro runner image (vide PR #136): $hits"
fi

# ---------------------------------------------------------------------------
# 3. Endpoints de recovery sem validacao de expiracao
# ---------------------------------------------------------------------------
# PRs #130-#132 em 2026-05-13 introduziram endpoint /api/admin/recover-...
# com token hardcoded. Funcionou pro propósito imediato, mas se nao for
# limpado deixa porta dos fundos em prod. CR-10 do ADR-003 v2: rotas em
# /api/admin/_temp/** devem ter validacao de expiracao (helper
# requireTempRouteValid de lib/temp-route.ts) OU marker explicito
# "TEMP_ROUTE_EXEMPT" no comentario do arquivo (rotas que querem ficar
# permanentes mas tem nome ambiguo, ex: diagnostico admin).
#
# Padroes de path considerados "temp" (apenas estes — NAO confundir
# "templates" com "temp"):
#   - /api/admin/_temp/**           (convencao oficial)
#   - /api/admin/recover*           (padrao historico dos PRs #130-#132)
temp_files=$(find app/api/admin/_temp -type f -name "route.ts" 2>/dev/null || true)
recovery_files=$(find app/api/admin -type d -name "recover*" 2>/dev/null \
  | while read d; do echo "$d/route.ts"; done)
for route_file in $temp_files $recovery_files; do
  [ -f "$route_file" ] || continue
  if ! grep -qE "x-expires-at|expiresAt|TempRouteValid|TEMP_ROUTE_EXEMPT" "$route_file"; then
    fail "Endpoint de recovery/temp sem validacao de expiracao (CR-10): $route_file"
  fi
done

# ---------------------------------------------------------------------------
# Resultado
# ---------------------------------------------------------------------------
if [ $EXIT -ne 0 ]; then
  echo ""
  echo "::error::FAIL: padroes proibidos encontrados. Veja docs/implementation/postmortem/POSTMORTEM-2026-05-13-deploys.md para contexto."
  exit 1
fi

echo "OK: nenhum padrao proibido encontrado"
