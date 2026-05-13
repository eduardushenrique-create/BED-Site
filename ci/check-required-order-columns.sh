#!/usr/bin/env bash
#
# R13 do ADR-003 v2: garante que `REQUIRED_ORDER_COLUMNS` em
# `app/api/health/route.ts` cobre todas as colunas escalares declaradas
# em `model Order` do `schema.prisma`.
#
# Sem isso, o vazamento de coluna nova (createdVia, paidAmount etc. em
# 2026-05-13) passa despercebido pelo healthcheck — foi o que mascarou
# o impacto do PR #141 antes do diagnose-list-orders revelar.

set -e

# Extrai colunas escalares de `model Order` em prisma/schema.prisma
schema_cols=$(awk '
  /^model Order \{/,/^\}/ {
    # Ignora cabecalho, fechamento, linhas comentadas, em branco, attrs @@
    if ($0 ~ /^model Order/ || $0 ~ /^\}/) next
    if ($0 ~ /^[[:space:]]*\/\//) next
    if ($0 ~ /^[[:space:]]*$/) next
    if ($0 ~ /^[[:space:]]*@@/) next

    name = $1
    type = $2

    # Considera escalar se o tipo (apos limpar `?` ou `[]`) eh primitivo Prisma.
    gsub(/[?[\]]/, "", type)
    if (type == "String" || type == "Int" || type == "Float" || \
        type == "Boolean" || type == "DateTime" || type == "Decimal" || \
        type == "Json" || type == "BigInt" || type == "Bytes") {
      print name
    }
  }
' prisma/schema.prisma | sort -u)

# Extrai entradas de REQUIRED_ORDER_COLUMNS no health route
required=$(awk "
  /const REQUIRED_ORDER_COLUMNS = \[/,/^\]/ {
    if (match(\$0, /'[A-Za-z_][A-Za-z0-9_]*'/)) {
      s = substr(\$0, RSTART+1, RLENGTH-2)
      print s
    }
  }
" app/api/health/route.ts | sort -u)

if [ -z "$schema_cols" ]; then
  echo "::error::FAIL: nao consegui extrair colunas de model Order em prisma/schema.prisma. Verifique o script."
  exit 1
fi

if [ -z "$required" ]; then
  echo "::error::FAIL: nao consegui extrair REQUIRED_ORDER_COLUMNS de app/api/health/route.ts. Verifique o script."
  exit 1
fi

# Diferenca: colunas no schema que NAO estao em REQUIRED
missing=$(comm -23 <(echo "$schema_cols") <(echo "$required"))

if [ -n "$missing" ]; then
  echo "::error::REQUIRED_ORDER_COLUMNS em app/api/health/route.ts esta desatualizado."
  echo "::error::Colunas declaradas em schema.prisma mas nao monitoradas pelo healthcheck:"
  echo "$missing" | while IFS= read -r c; do
    echo "::error::  - $c"
  done
  echo "::error::Adicione-as em REQUIRED_ORDER_COLUMNS para o health detectar vazamento de migration."
  echo "::error::Contexto: vide R13 em docs/implementation/adr/ADR-003-spec-005-safety-review.md"
  exit 1
fi

n_schema=$(echo "$schema_cols" | wc -l)
echo "OK: REQUIRED_ORDER_COLUMNS cobre todas as $n_schema colunas escalares de Order"
