# SPEC-002 — Relatório de QA

> Bloco 5 — Validação consolidada | Data: 2026-05-05

---

## Resumo

| Bloco | Status |
|-------|--------|
| Bloco 1 — Schema, helpers, serializers | PASSA |
| Bloco 2 — Picker de variação no admin | PASSA com ressalva |
| Bloco 3 — Filtros públicos / bloqueios | PASSA |
| Bloco 4 — UI de visibilidade + audit log | PASSA com ressalva |

---

## Validação estática

- [x] `npx tsc --noEmit` — **zero erros** (saída vazia = OK)
- [x] `npx next build` — **build completo sem erros**
- [ ] `npx eslint .` — **3 erros nos arquivos da SPEC-002** (ver detalhes abaixo). Outros erros existem no codebase mas são pré-existentes à SPEC-002.
- [x] Commits revisados — 5 commits (não 6 como mencionado na tarefa): `c2d03c3d`, `38b3a745`, `23e26d95`, `cb810b6c`, `896892d8`. Todos coerentes com a descrição dos blocos.

---

## Inspeção de código (pontos críticos)

| # | Ponto | Status | Referência |
|---|-------|--------|-----------|
| 1 | `serializeProduct` expõe `visibility` | OK | `lib/database.ts:150` |
| 2 | `serializeProduct` expõe `variants` | OK (com ressalva — ver Bug #1) | `lib/database.ts:151-165` |
| 3 | `serializeOrder` expõe `variantId` em items | OK | `lib/database.ts:271` |
| 4 | `serializeOrder` expõe `variantName` em items (fallback duplo) | OK | `lib/database.ts:272` |
| 5 | `include: { variant: true }` em todos os getters de Order | OK (8 ocorrências) | `lib/database.ts:1029,1375,1393,1413,1586,1656,1721,1824,1836` |
| 6 | `app/admin/pedidos/page.tsx` abre `VariantPicker` quando produto tem variantes | OK | linha 451-453 |
| 7 | `app/admin/pedidos/[id]/page.tsx` abre `VariantPicker` no modal "Editar Itens" | OK | linha 492-494 |
| 8 | `normalizeItems` preserva `variantId`/`variantName` ao carregar pedido existente | OK | `app/admin/pedidos/[id]/page.tsx:175-185` |
| 9 | `/api/pedidos POST` valida `variantId` obrigatório quando produto tem variantes | OK | `app/api/pedidos/route.ts:30-35` |
| 10 | `/api/pedidos PUT` valida `variantId` (mesma função) | OK | `app/api/pedidos/route.ts:62-67` |
| 11 | `lib/catalog.ts → getPublicProductWhere` tem `visibility: 'public'` | OK | `lib/catalog.ts:89` |
| 12 | `getPublicProductWhere` aplicado em listagem, slug lookup E categorias públicas | OK | `lib/catalog.ts:119,175,142` |
| 13 | `/api/orders POST` rejeita produto interno (defesa em profundidade) | OK | `app/api/orders/route.ts:125-127` |
| 14 | `/api/orders POST` valida variantId obrigatório para produto com variantes | OK | `app/api/orders/route.ts:151-155` |
| 15 | `/api/products/restock-alerts POST` retorna 404 para produto interno | OK | `app/api/products/restock-alerts/route.ts:54-56` |
| 16 | Toggle "Público / Interno" no formulário de produto | OK | `app/admin/produtos/page.tsx:671-684` |
| 17 | Badge "Interno" nos cards de produtos | OK | `app/admin/produtos/page.tsx:199` |
| 18 | Filtro chip "Internos" com contador | OK | `app/admin/produtos/page.tsx:341,354` |
| 19 | `/api/produtos PUT` registra `AuditLog` em mudança de visibility | OK | `app/api/produtos/route.ts:47-57` |
| 20 | Helpers `variantEffectivePrice` e `describeVariant` em arquivo compartilhado | OK | `lib/products/variant-pricing.ts` |

---

## Bugs encontrados

### Bug #1 — `updateProduct` e `createProduct` retornam `variants: []` após salvar

**Severidade:** Baixa (cosmética, não afeta dados persistidos)

**Arquivo:** `lib/database.ts:362` e `lib/database.ts:478`

**Descrição:** Tanto `createProduct` quanto `updateProduct` fazem um `findUniqueOrThrow` com `include: { category: true, images: true }` sem incluir `variants`. A função `serializeProduct` trata `variants` como `[]` quando o campo não vem do banco (guarda com `Array.isArray` antes de mapear). O resultado é que o payload de retorno do `POST /api/produtos` e do `PUT /api/produtos` tem `variants: []` mesmo que o produto tenha variantes.

**Impacto real:** O admin faz `loadProducts()` (novo fetch de listagem) após criar/salvar produto, então a UI não fica inconsistente por muito tempo. Mas se algum código no futuro depender diretamente do retorno do PUT para renderizar variantes, vai quebrar silenciosamente.

**Repro:**
1. Criar produto com variantes via `/admin/produtos`.
2. Inspecionar resposta do `POST /api/produtos` no DevTools Network.
3. Observar `"variants": []` no JSON de resposta, independente das variantes criadas.

**Comportamento esperado:** `variants` deve vir populado no retorno do create/update.

**Correção sugerida (para o dev):**
```
// lib/database.ts:359 (createProduct)
include: { category: true, images: true, variants: true }

// lib/database.ts:478 (updateProduct)
include: { category: true, images: true, variants: { orderBy: { name: 'asc' } } }
```

---

### Bug #2 — ESLint: 3 erros nos arquivos da SPEC-002

**Severidade:** Baixa (lint não bloqueia build/runtime, mas indica má prática)

**Arquivo 1:** `app/admin/pedidos/[id]/page.tsx:176` — `@typescript-eslint/no-explicit-any` em `normalizeItems`

**Arquivo 2:** `app/admin/produtos/page.tsx:298` — `react-hooks/set-state-in-effect` (localStorage read no useEffect é padrão idiomático mas o linter reclama)

**Arquivo 3:** `app/api/produtos/route.ts:31` — `@typescript-eslint/no-explicit-any` no cast `(prisma as any).product`

**Repro:** `npx eslint app/admin/pedidos/\[id\]/page.tsx app/admin/produtos/page.tsx app/api/produtos/route.ts`

**Nota:** Os erros ESLint de `any` são consequência de work-around para o Prisma não ter tipagem forte na camada de abstração. O bug de `set-state-in-effect` é pré-existente no padrão do projeto (outros arquivos têm o mesmo). Não impede o funcionamento.

---

### Observação: 5 commits, não 6

**Severidade:** Informacional

A tarefa menciona "6 commits da SPEC-002". Na branch existem 5: `c2d03c3d`, `38b3a745`, `23e26d95`, `cb810b6c`, `896892d8`. O commit `38b3a745` foi o "bloco 1.1" (pré-stage do bloco 1), não um bloco separado numerado na SPEC. Não há gap funcional — todos os requisitos dos 4 blocos estão presentes.

---

## Plano de teste manual

Ver `SPEC-002-test-plan.md`. **Ainda não executado** (requer ambiente com DB + variáveis configuradas).

O plano cobre:
- **Grupo A** (11 casos): variações no admin — criação, picker, linhas separadas, incremento, sem variante, salvar/reabrir, editar itens, esgotado sem bloqueio, validação server-side (400).
- **Grupo B** (3 casos): regressão do site público.
- **Grupo C** (11 casos): produto interno — badge, filtro público, 404, API, bloqueio checkout, restock-alert, acesso admin, fulfillment, reverter, chip filtro, AuditLog.
- **Grupo D** (4 casos de borda): checkout sem variantId, pedido antigo sem variantId, submit duplo, produto deletado.

---

## Testes E2E Playwright

**Status:** Não escritos para a SPEC-002.

**Justificativa:** O `playwright.config.ts` está configurado com `testDir: './tests'` e já existe `tests/e2e.spec.ts` cobrindo fluxos genéricos do site. Os fluxos da SPEC-002 (picker de variação no admin, produto interno) exigem autenticação de admin e dados específicos (produto com variantes no banco), o que torna os specs Playwright frágeis sem um `beforeAll` de seed adequado — seed que não existe hoje. Escrever specs E2E sem seed controlado gera falsos negativos em CI limpo.

**Recomendação:** Criar `tests/seed-spec-002.ts` com fixture de produto + variantes + produto interno antes de escrever os specs. Isso é trabalho para uma sessão separada.

---

## Riscos remanescentes

| Risco | Probabilidade | Mitigação presente |
|-------|--------------|-------------------|
| Pedidos antigos sem `variantId` — exibição no admin | Baixa | `normalizeItems` faz `item.variantId ?? null`; `displayName` cai para só o `productName`. OK. |
| `serializeProduct` retorna `variants: []` após create/update | Média | Admin faz reload após salvar. Sem impacto imediato. Corrigir no próximo ciclo. |
| Produto marcado como interno pode ter `OrderItem.variantId` `SetNull` se variante for deletada | Baixa | Schema usa `ON DELETE SET NULL` para `OrderItem.variantId`. Histórico preservado. |
| `POST /api/products/restock-alerts` com Turnstile desabilitado em dev pode não chegar à checagem de visibilidade | Baixa | Código está correto; Turnstile falha antes. Em produção Turnstile está ativo. Workaround: testar com token bypass ou mockar `verifyTurnstileToken`. |
| Filtro "Internos" no chip-bar não exibe contador em modo mock (sem DB) | Baixa | `products.filter(p => p.visibility === 'internal').length` — dados mock não têm o campo; retorna 0 sem crash. |

---

## Recomendação

- [x] Aprovar para merge com ressalva

**Ressalva (follow-up antes de produção):**

1. Corrigir Bug #1: adicionar `variants: true` nos `include` de `createProduct` e `updateProduct` em `lib/database.ts`.
2. Resolver Bug #2: os 3 erros ESLint nos arquivos da SPEC-002 (minor — o projeto já convive com ESLint errors pré-existentes, mas novos erros não devem ser acumulados).
3. Executar o plano manual `SPEC-002-test-plan.md` em ambiente com DB antes do deploy em produção.
