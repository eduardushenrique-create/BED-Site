# ADR-003 — Revisão de segurança da SPEC-005 à luz dos incidentes de 2026-05-13

**Status:** Proposto v2 (revisado por agente arquiteto + security-architect independentes)
**Data:** 2026-05-13
**Decididores:** Stakeholder do projeto (Edu)
**Substitui:** v1 (rascunho)
**Relaciona-se com:** [SPEC-005](../spec/SPEC-005-edicao-producao-pagamentos-parciais.md) · [POSTMORTEM-2026-05-13-deploys.md](../postmortem/POSTMORTEM-2026-05-13-deploys.md)

> **Changelog v1 → v2:** dois agentes independentes (arquiteto + security-architect) revisaram a v1 e identificaram **13 riscos novos** (cache Next 16, drift de `paidAmount`, race admin×webhook, amount tampering, refund replay, LGPD, PII em texto livre, etc.) e **2 problemas técnicos** (sintaxe Prisma de lock, refund job sem infra clara). Esta v2 incorpora tudo. Decisão de produto adicional: **cortar refund automático Mercado Pago do escopo inicial** (YAGNI + risco financeiro alto).

---

## Sumário em 30 segundos

A SPEC-005 (excluir/editar item de produção + pagamentos parciais) **pode ser implementada com segurança**, mas exige:

- **10 gates de infra** antes de tocar schema (`G1-G10`).
- **22 classes de risco** mapeadas com mitigação concreta cada (`R1-R22`).
- **3 falhas operacionais** documentadas (`F1-F3`) que viram processo, não código.
- **9 PRs pequenos** em sequência rígida, com aprovação humana por PR.
- **Cortar refund automático MP** do escopo inicial (risco financeiro alto, volume hoje = 0).
- **5-8 dias úteis** de trabalho meu + ~1h total de aprovações suas.

Sem isso, repetimos o padrão de 2026-05-13 com sintoma diferente.

---

## Contexto

A SPEC-005 (excluir/editar item da produção + pagamentos parciais) foi aprovada em 2026-05-13 e a Fase 1 (schema) foi tentada em PR #141 — derrubou prod. Revert (#142) vazou colunas no schema; sintoma só apareceu horas depois com painel admin vazio (#145 corrigiu). PR #143 (ADR-002) com fail-fast mal escrito quebrou boot (#144 reverteu). **Três deploys defeituosos em ~1h.** Pedidos preservados, downtime acumulado ~25 min.

O post-mortem identificou: o pipeline atual permite que um único descuido derrube prod, e a SPEC-005 toca em superfícies de risco múltiplas (schema, queries de Order, fluxo de notificação, ProductionTask, integração com MP, dados pessoais).

**Esta ADR não substitui a SPEC-005** — confirma o escopo (com 1 corte) e ajusta o **plano de implementação** com gates e mitigações específicas.

### Forças em jogo

- **Histórico:** 3 falhas em <1h hoje. Próxima quebra é inadmissível.
- **Pendências críticas vivas:**
  - Prisma CLI quebrado em runtime (`prisma migrate deploy` não funciona em prod).
  - `createOrder` e `updateOrder` ainda têm fallback `readDB/writeDB` no catch geral em prod (vulnerabilidade que causou perda de 4 pedidos na manhã — confirmado em `lib/database.ts:1923-1930` e `lib/database.ts:2091-2099`).
  - Sem boot smoke test, sem branch protection, sem auto-revert, sem alerta externo.
  - `REQUIRED_ORDER_COLUMNS` em `app/api/health/route.ts:25` é hardcoded — passou despercebido pelo health o vazamento de colunas em #141 porque as colunas vazadas não estavam na lista.
- **Superfície técnica que SPEC-005 vai tocar:** schema/migrations, `lib/database.ts`, `lib/order-notifications.ts`, `lib/order-production-bridge.ts`, `lib/payment.ts`, ~10 endpoints novos, ~6 telas/modais.

---

## Decisão

**Aprovar a SPEC-005 com:**

1. **Mantido:** todo o escopo de excluir/editar produção (3 modos), todo o escopo de pagamentos parciais manuais (`createdVia` + `paidAmount`/`dueAmount` + `PaymentInstallment`).
2. **Cortado do escopo inicial:** refund automático via API do Mercado Pago. Substitui por status manual (`refundStatus`) + botão "Marcar como estornado" no admin. Razão: 0 cancelamentos com MP nos últimos meses (sem volume), risco financeiro alto (idempotency, janela 90d, replay), adiciona ~30% do trabalho da Fase 2. Pode virar SPEC-006 quando aparecer primeiro caso real.
3. **Adicionado:** 10 gates de infra obrigatórios antes de QUALQUER linha da SPEC-005 ir para `main`.
4. **Reescrito:** plano de implementação em 9 PRs pequenos, com aprovação humana por PR (sem auto-merge em arquivos sensíveis), cooldown de 60min entre merges sensíveis.

---

## 22 classes de risco com mitigação

### Camada A — Risco de quebrar prod no deploy (que aconteceu hoje 3×)

#### R1 — Migration vaza schema (REINCIDÊNCIA do incidente desta noite)

**Sintoma:** Prisma client espera coluna que não existe → `findMany` estoura → painel admin vazio (= o que aconteceu em #141).

**Probabilidade hoje:** alta. `prisma migrate deploy` no boot ainda quebra (Prisma 7 CLI sem deps). Aplicação manual depende de coordenação humana.

**Mitigação:**
1. Migration aplicada no banco **antes** do schema.prisma chegar em main (via ADR-002 retomada com `pg` direto + canary).
2. Verificação automática pós-merge: workflow `migrate-status-check` que abre issue se houver mismatch.
3. **R13 (abaixo)**: `REQUIRED_ORDER_COLUMNS` gerado dinamicamente do schema, não hardcoded.

**Gate:** mitigado quando canary inerte aplica em prod via o caminho escolhido e painel permanece operacional 30min.

---

#### R2 — `createOrder` e `updateOrder` caindo em fallback localDb (CONFIRMADO presente)

**Sintoma:** se `prisma.order.create()` ou `update()` lançar (ex: schema desalinhado), o catch grava no JSON volátil. Container Railway descarta no próximo deploy. **Pedido perdido.**

**Probabilidade hoje:** alta se Fase 1 mergeada antes de R1 mitigado.

**Evidência:** `lib/database.ts:1923-1930` (createOrder) e `lib/database.ts:2091-2099` (updateOrder) têm `reportDbError(... 'using fallback'); readDB(); writeDB()`. PR #127 protegeu apenas o caminho de "DB ausente na entrada", não o catch geral.

**Mitigação:**
1. Refactor: catch em prod (`FAIL_FAST_IN_PRODUCTION === true`) deve **lançar `DatabaseUnavailableError`** em vez de fallback.
2. **Criar `lib/errors.ts::DatabaseUnavailableError`** + handler/middleware Next 16 que mapeia pra HTTP 503 com body `{error: 'database_unavailable'}`.
3. Smoke test em CI: validar que createOrder em modo prod com Postgres "broken" retorna 503 (não silenciosamente grava).
4. Capturar para Sentry com severity `error` em vez de `warn`.

**Gate:** mitigado quando os 2 caminhos de catch fail-fast em prod e teste automatizado valida.

---

#### R10 — Cache do Next.js 16 servindo lista vazia/stale (NOVO — agente arquiteto)

**Sintoma:** após backfill da migration, `/admin/pedidos` ou `/minha-conta/pedidos` pode servir versão cacheada (build ou ISR) sem `createdVia` no filtro, mostrando 0 pedidos quando deveria mostrar alguns.

**Evidência:** confirmado por inspeção: nenhum arquivo em `app/admin/pedidos` ou `app/minha-conta/pedidos` declara `dynamic = 'force-dynamic'` (apenas `app/admin/page.tsx`). Next 16 mudou defaults de cache.

**Mitigação:**
1. Auditar todas as páginas que listam Order: `app/minha-conta/pedidos/**`, `app/admin/pedidos/**`, `app/admin/producao/**` — declarar `export const dynamic = 'force-dynamic'` OU usar `revalidateTag('orders')` em toda mutação.
2. Documentar tags de cache pra `Order` e invalidar nas 4 mutações de installment + 3 modos de DELETE de produção.

**Gate G7:** snapshot test "criar pedido `createdVia='admin'` → `/minha-conta/pedidos` continua sem ele".

---

### Camada B — Risco de inconsistência financeira/dados

#### R3 — Race condition em `paidAmount`/`dueAmount` (corrigido tecnicamente)

**Sintoma:** dois admins clicam "Registrar pagamento" simultâneo. Ambos leem `paidAmount=100`, somam +50, escrevem `paidAmount=150` (deveria ser `200`). **R$ 50 perdidos.**

**Mitigação (CORRIGIDA — v1 estava com sintaxe errada):**

Escolher UM caminho (não os dois):

```ts
// Caminho A — FOR UPDATE explícito + READ COMMITTED (default)
await prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`
  // ... cria/altera installment ...
  // ... recalcula via recalculatePaidAmount ...
})
```

**Validar:** `isolationLevel: 'Serializable'` com `@prisma/adapter-pg` em Prisma 7 pode ser ignorado silenciosamente — testar antes de mergear PR-7a.

**Teste obrigatório:** 100 chamadas concorrentes ao `POST /installments` → resultado final consistente.

**Gate:** teste de concorrência passa.

---

#### R11 — Drift silencioso `paidAmount` vs `SUM(installments)` (NOVO — agente arquiteto)

**Sintoma:** decisão #2 da SPEC mantém `paidAmount` persistido (não computed) por performance. Em 6 meses, alguma mutação esquece de atualizar a denormalização. R3 cobre race; R11 cobre **drift estrutural** (1 mutação esquecida em 1 path).

**Mitigação:**
1. **Função utilitária única `recalculatePaidAmount(orderId)`** em `lib/installments.ts`. **Banir mutação direta de `paidAmount`** fora dessa função via `forbidden-patterns` (CR-8): `grep "paidAmount:" --exclude=lib/installments.ts` falha.
2. **Cron noturno** (workflow GitHub Action diário): query de divergência, reporta em `/api/admin/diagnose-paidAmount-drift`.
3. **Endpoint admin de reconciliação:** botão "Recalcular saldo deste pedido" que força `recalculatePaidAmount`.

**Gate:** cron rodou 7 dias sem reportar drift.

---

#### R12 — Concorrência admin × webhook MP no mesmo Order (NOVO — agente arquiteto)

**Sintoma:** admin abre modal "Cancelar pedido" → 2s depois webhook MP chega confirmando pagamento → admin clica confirmar → webhook escreveu `paymentStatus='paid'` mas admin sobrescreve com `cancelled` sem ler. Lock de R3 cobre admin↔admin, **não** admin↔webhook (paths diferentes em `lib/database.ts:2102` `updateOrderPaymentByNumber`).

**Mitigação:**
1. **Versão otimista** em `Order` via `updatedAt` check no UPDATE WHERE.
2. Webhook MP também passa por `prisma.$transaction` com `SELECT ... FOR UPDATE` no mesmo Order id.
3. Se admin tenta cancelar pedido com `updatedAt` mais novo do que viu, modal pede refresh.

**Gate:** teste e2e: webhook chega no meio do cancel → operação adequada (admin é avisada, não sobrescreve cego).

---

#### R17 — Amount tampering ilimitado em `POST /installments` (NOVO — security-architect, P0)

**Sintoma:** sem validação de range, agente confuso (= cenário hoje) ou admin malicioso grava `amount=999999999.99` ou `amount=-50000`. `paidAmount` resultante estoura `total` e dispara `autoTransitionOnPayment` indevidamente. **Sem CHECK constraint, vira buraco financeiro.**

**Mitigação:**
1. Schema: `CHECK (amount > 0 AND amount <= 100000)` na coluna `amount` de `PaymentInstallment`.
2. Validação Zod no handler: `.positive().max(orderTotal * 1.5)`.
3. **Bloquear `paidAmount > total * 1.2`** com erro explícito (margem 20% para gorjeta/correção, não estorro).
4. UI: campo numérico com `min` e `max`, formatação BRL, alerta visual se `> total atual`.

**Gate G9:** smoke test de "registrar amount negativo / astronômico" retorna 400.

---

#### R19 — Refund baseado em `Payment.amount` vs `Order.total` editado depois (NOVO — security-architect, P0)

**Sintoma:** SPEC §9.5 confia em `Payment.amount === Order.total` como prova de "100% MP". Se admin **editou itens** após pagamento (SPEC §3.1.1 permite), `Payment.amount` (R$ 480) pode ser diferente do `Order.total` novo (R$ 600 ou R$ 300). Refund automático paga o valor errado.

**Mitigação (após o corte de escopo, vira mais simples):**

Como cortamos refund automático do escopo inicial (vide §"Decisão"), R19 vira:
1. Botão "Marcar como estornado" no admin exige campo "Valor estornado (R$)" preenchido manualmente. Sem auto-cálculo. Admin confere o que de fato devolveu.
2. Para o futuro (SPEC-006): refund automático só permitido se nenhum item foi editado após `Payment.paidAt` E `Payment.amount >= Order.total atual`. Diferença explícita.

**Gate:** teste: editar item → reduzir total → cancelar → status correto, `refundStatus='manual_required'` (sem chamada MP).

---

#### R18 — Refund replay/race + idempotency MP (NOVO — security-architect, P0; afetado pelo corte)

**Após corte:** R18 vira teórico (não vamos chamar MP refund automaticamente nesta fase). Mas o controle continua válido para o **futuro** (SPEC-006) e para o botão manual de "Marcar como estornado" (não chama MP, mas escreve `refundStatus`):

**Mitigação:**
1. Lock pessimista em `Order.refundStatus` antes de transicionar.
2. Limite de 3 cliques/min no botão (rate limit).
3. UI mostra `refundStatus` atual e desabilita botão se já marcado.

**Gate:** teste: 3 cliques rápidos → 1 transição apenas.

---

### Camada C — Risco de inconsistência operacional

#### R4 — Cancelamento de pedido (modo `ORDER`) deixa estado inconsistente

**Mitigação (mantida da v1):**
1. Toda cascata em `prisma.$transaction` com timeout 10s.
2. Email FORA da transação com retry (R23 de email).
3. AuditLog com snapshot pré-cancelamento (recuperação possível).
4. **Refund (após corte):** apenas seta `refundStatus='manual_required'`, sem chamada externa.

**Gate:** teste "falha no meio do cancel" mostra rollback completo.

---

#### R7 — Sincronização OrderItem ↔ ProductionTask (gap real CONFIRMADO)

**Confirmado por leitura de `lib/order-production-bridge.ts`:** existe APENAS `triggerProductionTasksOnStatusChange` que CRIA tasks. **Não há gatilho pra UPDATE.** SPEC §3.1.1 admite o gap.

**Mitigação:**
1. Criar 2 funções novas em `lib/order-production-bridge.ts`:
   - `recomputeProductionTaskForOrderItem(orderItemId)` — chamado em `updateOrder` quando `data.items` é tocado.
   - `cancelProductionTaskForOrderItem(orderItemId)` — chamado em `DELETE producao mode=ITEM_ONLY` (soft-delete OrderItem).
2. Regra: se redução de quantidade fica abaixo de `producedQuantity` atual → bloquear com erro "Já foram produzidas X unidades".
3. Auditoria explícita em todas as transições.

**Gate:** 4 testes passam: aumentar qtd, reduzir qtd, reduzir-abaixo-de-produzido (deve falhar), soft-delete OrderItem (cancela task).

---

### Camada D — Risco de privacidade e comunicação errada

#### R5 — Guarda `createdVia === 'admin'` faltando em algum caminho (parcialmente coberto na v1)

**Mitigação (REFORÇADA — security-architect identificou que lint não basta):**

1. **Centralizar guarda em `notifyOrderStatusChange`** (não em call sites).
2. **Helper único `listVisibleOrdersForCustomer(customerId)`** em `lib/customer-orders.ts`. Toda rota cliente importa daqui.
3. **Defesa em profundidade — Prisma extension:**
   ```ts
   prisma.$extends({
     query: {
       order: {
         findMany({ args, query }) {
           // Em contexto 'customer', injeta createdVia='site' automaticamente
           if (currentContext === 'customer') {
             args.where = { ...args.where, createdVia: 'site' }
           }
           return query(args)
         }
       }
     }
   })
   ```
4. **Lint check (CR-8):** falha em `prisma.order.findMany` em `app/minha-conta/**` sem `createdVia: 'site'` explícito. Lint sozinho não basta — Prisma extension é a defesa real.
5. **Middleware Next.js:** nega acesso a `/minha-conta/**` em pedidos com `createdVia='admin'` mesmo se a query vazar (último cinto de segurança).

**Gate G8:** três layers ativos (helper + extension + lint).

---

#### R14 — Endpoints multi-pedido (NOVO — agente arquiteto)

**Sintoma:** `app/api/pedidos/bulk` e similares iteram sobre múltiplos pedidos. Se algum loop não filtra `createdVia`, pode disparar email pra cliente de pedido manual.

**Mitigação:**
1. Auditar TODOS os endpoints que iteram sobre orders (`/api/pedidos/bulk`, `/api/pedidos` GET, qualquer cron de "pedidos pendentes há X dias").
2. **CR-8 forbidden-pattern:** "loop sobre orders sem checagem `createdVia`".

**Gate:** auditoria documentada em PR-7a.

---

#### R21 — PII em campos de texto livre (NOVO — security-architect)

**Sintoma:** admin escreve "Pago em dinheiro - cliente CPF 123.456.789-00" em `description` ou `notes` de installment. Texto vai pra AuditLog, backups, **UI do cliente** (SPEC §3.2.5 mostra `description` no bloco do cliente).

**Mitigação:**
1. UI cliente mostra APENAS: `method` + `amount` + `receivedAt`. **Não** mostra `description`/`notes` brutos.
2. Admin recebe disclaimer no modal: "Este texto será visível apenas para você. Mantenha sem CPF/RG."
3. Validação server-side com regex de PII conhecida (CPF `\d{3}\.?\d{3}\.?\d{3}-?\d{2}`, telefone) — rejeita ou marca para review.

**Gate:** teste: PII rejeitada com mensagem clara.

---

#### R15 / R22 — LGPD: pedidos `createdVia='admin'` órfãos do `/minha-conta` (NOVO — ambos os agentes)

**Sintoma:** pedidos manuais com `customerEmail=cliente@x.com` ficam no DB com nome+telefone, mas cliente não vê. Quando exerce direito LGPD (portabilidade ou esquecimento), comportamento é ambíguo.

**Mitigação (decisão de produto pendente — pedida ao stakeholder):**

Recomendação:
1. **Portabilidade (LGPD Art. 18 V):** **incluir** pedidos admin no export — são dados pessoais do cliente.
2. **Esquecimento (LGPD Art. 18 VI):** anonimizar — `customerName='[anonimizado]'`, `customerEmail='redacted-{hash}@redacted'`, mantém estrutura financeira para fins fiscais (5 anos).
3. **Função `purgeCustomerData(email)`** centralizada que cobre `Order` (todos `createdVia`) + outras tabelas com PII.

**Gate:** decisão de produto registrada antes de PR-8b. Função existe e testada.

---

### Camada E — Risco de reutilização e cron

#### R6 — Refund automático MP (CORTADO do escopo inicial)

**Decisão:** **REMOVER** do escopo inicial da SPEC-005.

**Razões consolidadas:**
- Volume real: 0 cancelamentos com MP nos últimos meses (= YAGNI).
- Risco financeiro: idempotency-key, janela 90d, replay, retry race — mitigações complexas.
- ~30% do trabalho da Fase 2 some.
- Pode virar SPEC-006 com tempo (1-2 dias trabalho isolado) quando aparecer primeiro caso real.

**Mantido:**
- Campo `Order.refundStatus` (`null | 'manual_required' | 'refunded' | 'failed'`).
- Botão "Marcar como estornado" no admin (apenas seta status; admin estorna pelo painel MP fora do sistema).
- UI mostra status visualmente.

---

#### R8 — Webhook MP cria PaymentInstallment duplicado (mantida v1)

**Mitigação:**
1. Idempotência por `paymentId`: índice único parcial `CREATE UNIQUE INDEX ON "PaymentInstallment"("paymentId") WHERE "paymentId" IS NOT NULL`.
2. Upsert no handler.
3. Teste: processar mesmo webhook 5× → 1 installment.

---

#### R23 — Webhook MP de refund (entrada complementar a R6 — NOVO security-architect)

**Após corte:** R23 vira menos crítico. Mas se algum dia retomar refund automático (SPEC-006), precisa do handler. Por agora: documentar em SPEC-006 futura.

---

#### R13 — `REQUIRED_ORDER_COLUMNS` hardcoded (NOVO — agente arquiteto, era parcial em R1)

**Mitigação:**
1. Job CI compara `REQUIRED_ORDER_COLUMNS` com colunas declaradas no schema.prisma. Falha se schema tem coluna que não está na lista.
2. OU: gerar lista a partir do schema em build time.

**Gate:** job CI ativo no PR-3.

---

#### R16 — Performance lock pessimista em batch (NOVO — agente arquiteto, baixo)

**Mitigação:**
1. Documentar: lock é **por-Order** (não global).
2. Jobs em lote (cron de drift R11) usam `FOR UPDATE SKIP LOCKED` ou processam em chunks.

---

### Camada F — Risco de auditoria e operação

#### R9 — `createdVia` esquecido em `/api/orders` ou `/api/pedidos` (mantida v1)

**Mitigação:** TypeScript com parâmetro obrigatório (sem default na assinatura). `createOrder({ ..., createdVia: 'site' })` ou `'admin'` explícito.

---

#### R20 — Step-up auth para `DELETE ?mode=ORDER` (NOVO — security-architect)

**Sintoma:** admin com sessão sequestrada pode dreno financeiro com 1 clique.

**Mitigação:**
1. Modo `ORDER` exige header com password reentry (modal pede senha admin).
2. Rate limit `5/hora por admin` em `?mode=ORDER`.
3. Confirmação dupla (modal mostra impacto, exige digitar número do pedido para liberar botão).

**Gate G10:** modal funcional + rate limit ativo.

---

#### R24 — AuditLog precisa snapshot before/after (NOVO — security-architect)

**Mitigação:** mutações financeiras gravam `metadata: { before: {...}, after: {...} }` em `AuditLog`.

---

#### R25 — Rate limit em DELETE installment (NOVO — security-architect)

**Mitigação:** rate limit `10/hora/admin` em `DELETE /api/pedidos/[id]/installments/[installmentId]`.

---

#### R26 — Credenciais MP (NOVO — security-architect)

**Mitigação:** auditoria de env vars para confirmar que `MP_ACCESS_TOKEN` (refund permission) não está commitado e está rotacionado pré-go-live.

---

## 10 gates obrigatórios antes de QUALQUER linha da SPEC-005

| # | Gate | Origem | Sem isso, qual risco fica exposto |
|---|---|---|---|
| **G1** | UptimeRobot ativo (CT-5) | Post-mortem | Detecção pós-deploy só pelo stakeholder |
| **G2** | Branch protection + label automático (CR-7) | Post-mortem | Auto-merge em arquivos sensíveis |
| **G3** | CR-1b (lista expandida) + CR-8 (forbidden-patterns) | Post-mortem + R5/R11/R14 | Padrões anti recorrentes |
| **G4** | Boot smoke test no CI (CT-1) | Post-mortem | Bugs runtime tipo `new PrismaClient()` |
| **G5** | R1 mitigado: caminho de migration funciona em prod (canary) | ADR | Migration silently fail (= incidente hoje) |
| **G6** | R2 mitigado: createOrder/updateOrder fail-fast em prod | ADR | Pedido perdido em fallback localDb (= incidente manhã) |
| **G7** | R10 mitigado: cache Next 16 com `force-dynamic` ou `revalidateTag` | Arquiteto | Listagem stale após backfill |
| **G8** | R5 mitigado em 3 layers (helper + extension + middleware) | Security | Vazamento `createdVia='admin'` para cliente |
| **G9** | R17 mitigado: amount validation (CHECK + Zod + bound) | Security (P0) | Tampering financeiro |
| **G10** | R20 mitigado: step-up auth em DELETE mode=ORDER | Security | Sessão sequestrada = dreno |

**Tempo estimado para implementar G1-G10:** 5-7h de trabalho meu, distribuído em 5 PRs separados (G1 fora do repo, G2+G3+G4 em PRs, G5 dentro de PR-5, G6 em PR-4, G7+G8+G9+G10 dentro de PR-7a/b).

---

## Plano de implementação revisado (9 PRs em ordem rígida)

| PR | Conteúdo | Risco | Depende de |
|---|---|---|---|
| **PR-1** | CT-5 (UptimeRobot) — config externa | Zero | — |
| **PR-2** | CR-7 (labeler.yml + branch protection settings) + CR-1b | Baixo | PR-1 |
| **PR-3** | CR-8 (forbidden-patterns CI) + CT-1 (boot smoke) + R13 (lista vs schema) | Baixo | PR-2 |
| **PR-4** | R2: refactor createOrder + updateOrder fail-fast + `DatabaseUnavailableError` | Médio | PR-3 |
| **PR-5** | ADR-002 retomada com `pg` direto + canary inerte (G5) | Médio | PR-4 mergeado e estável 24h |
| **PR-6** | **SPEC-005 Fase 1: schema + migration** (createdVia, paidAmount, dueAmount, refundStatus, deletedAt, PaymentInstallment com CHECK constraint de R17) | Médio (mas mitigado por G1-G6) | PR-5 estável 48h |
| **PR-7a** | SPEC-005 Fase 2a: `lib/installments.ts` (recalculatePaidAmount, transação com lock R3) + 4 endpoints CRUD installments + cron drift R11 + Prisma extension R5 | Médio-alto | PR-6 estável 24h |
| **PR-7b** | SPEC-005 Fase 2b: DELETE produção 3 modos + sync ProductionTask R7 + step-up auth R20 + rate limits R25 | Médio-alto | PR-7a estável 24h |
| **PR-8a** | SPEC-005 Fase 3a: admin UI (modais, seções, snapshot tests) | Baixo | PR-7b estável 24h |
| **PR-8b** | SPEC-005 Fase 3b: cliente UI (com middleware R5 + filtro createdVia + decisão LGPD R15/R22) | Baixo | PR-8a + decisão LGPD aprovada |

**Total:** 10 entregas (9 PRs + 1 config externa). **Tempo: 5-8 dias úteis** (não 3-5 — agente arquiteto revisou estimativa).

**Cada PR sensível exige:**
- CI verde (lint + typecheck + build + boot smoke + forbidden-patterns).
- Diff revisado.
- Plano de revert documentado em <100 palavras.
- Aprovação humana explícita (você responde "ok mergeia" no PR — não por lote).
- Sem auto-merge.
- Após merge: validação visual ~5min com `/api/health` + `/api/admin/diagnose-list-orders` (contagem de pedidos >= antes do merge).
- Cooldown 60min antes do próximo PR sensível.
- Para PRs que tocam schema: confirmação que migration aplicada está sincronizada com `_prisma_migrations` em prod.

---

## Critérios objetivos de "pronto pra mergear" (executáveis)

- [ ] CI verde (todos os jobs)
- [ ] **Boot smoke test passou 3/3** sem retry (sem `continue-on-error: true`). Se flaka 1×, abrir issue automática `flaky:smoke-test` e bloquear merge até investigação manual.
- [ ] Diff revisado por você (não pulei nada não-relacionado)
- [ ] Plano de revert documentado, **<5min de execução**, testado mentalmente
- [ ] Para PRs que tocam schema: SQL revisado + confirmação de sincronização com `_prisma_migrations` em prod
- [ ] Para PRs que tocam payment: simulação de "MP fora" no test plan
- [ ] Para PRs que tocam notifications: log de `notification.skipped` validado para `createdVia='admin'`
- [ ] Aprovação humana explícita (você responde "ok mergeia" naquele PR)
- [ ] Pós-merge: `/api/admin/diagnose-list-orders` retorna contagem >= contagem pré-merge (cair = revert imediato)

---

## 3 falhas operacionais (processo, não código)

### F1 — Cancelamento silencioso pra cliente

SPEC §9.2: pedido admin é silencioso (sem email). Mas se admin cancela sem avisar, cliente liga reclamando.

**Mitigação:** UI de cancelamento (modo `ORDER`) mostra checkbox: `□ Confirmo que comuniquei o cliente fora do sistema (WhatsApp, telefone)`. Botão Confirmar só habilita se marcado. Auditoria registra que foi marcado.

### F2 — "Estorno pendente" sem prazo

Sem refund automático MP no escopo inicial, todo refund é manual. Cliente pode questionar prazo.

**Mitigação:** botão "Marcar como estornado" exige campo data + valor; auditoria; SLA documentado em política interna ("estorno em até 5 dias úteis após cancelamento"); admin avisa cliente fora do sistema (F1).

### F3 — "Confirmar mesmo assim" com saldo aberto vira costume

SPEC §3.2.3 permite escape consciente. Risco: admin usa rotineiramente, perde controle de caixa.

**Mitigação:** limite **3 exceções/mês por admin** (rastreado em `AuditLog`). Após, exige aprovação stakeholder. Relatório semanal automatizado lista pedidos com `payment.exception`.

---

## Decisões de produto pendentes (do stakeholder)

1. **LGPD R15/R22:** aprovação da política proposta (portabilidade inclui pedidos admin; esquecimento anonimiza). Sem isso, PR-8b bloqueia.
2. **F1:** OK com checkbox de confirmação de comunicação manual?
3. **F3:** OK com limite de 3 exceções/mês?

---

## Cortes do escopo (com justificativa)

| Item | Status | Razão |
|---|---|---|
| Refund automático via API MP (SPEC §9.5) | **CORTADO** do escopo inicial | Volume hoje = 0; risco financeiro alto; ~30% do trabalho da Fase 2; pode virar SPEC-006 |
| Tudo o resto da SPEC-005 | Mantido | OK com mitigações |

---

## Consequências

**Mais fácil:**
- Implementar SPEC-005 sem repetir o padrão de hoje.
- Detectar quebras antes do usuário (UptimeRobot + boot smoke + healthcheck dinâmico).
- Reverter com confiança (PRs pequenos, isolados, plano de revert).
- Ter clareza financeira (R3+R11+R17+R24 cobrem race + drift + tampering + auditoria).
- Evitar risco financeiro de refund duplicado (corte do escopo).

**Mais difícil:**
- Tempo total maior (5-8 dias vs. tentar tudo em 1 dia, como hoje).
- Você aprova PR por PR (sem lote).
- Custo: minutos GH Actions free tier + UptimeRobot free tier (~zero).
- Refund MP fica manual (admin estorna pelo painel deles, registra valor).

**A revisitar quando o sistema crescer:**
- SPEC-006: refund automático MP com idempotency key, janela 90d, retry job, webhook handler.
- Lock pessimista em paidAmount (R3): se houver N admins ativos, considerar otimistic concurrency com `version`.
- ProductionTask sync (R7): se ficar complexo, considerar evento explícito.
- Multi-tenant: usar `customerId` (FK) em vez de `customerEmail` (string) onde possível (R26 preventiva).

---

## Action items (sequenciais)

1. [ ] **Stakeholder aprova ADR-003 v2** (com cortes e plano de 9 PRs).
2. [ ] **Stakeholder aprova decisões pendentes** (LGPD, F1, F3).
3. [ ] **PR-1 (UptimeRobot)** — eu configuro fora do repo, mostro evidência.
4. [ ] **PR-2 (labeler + branch protection)** — eu abro PR, você revê + aplica em GitHub Settings.
5. [ ] **PR-3 (forbidden-patterns + boot smoke + R13 check)** — eu abro PR, validamos com PR sintético com `new PrismaClient()` que deve falhar.
6. [ ] **PR-4 (createOrder/updateOrder fail-fast + DatabaseUnavailableError)** — eu abro PR, validação local com Postgres "broken".
7. [ ] **PR-5 (ADR-002 retomada com pg direto + canary)** — eu abro PR, validamos canary em prod.
8. [ ] **Após PR-5 verde por 24h:** PR-6 (Fase 1 schema com CHECK constraint R17).
9. [ ] **Após PR-6 verde por 48h:** PR-7a (installments CRUD + drift cron).
10. [ ] **Após PR-7a verde por 24h:** PR-7b (DELETE produção + sync ProductionTask).
11. [ ] **Após PR-7b verde por 24h:** PR-8a (admin UI).
12. [ ] **Após PR-8a verde por 24h + decisão LGPD aprovada:** PR-8b (cliente UI).

---

## Decisão final pendente

Stakeholder, escolha:

- **(A) Aprovar ADR-003 v2 e prosseguir** com PR-1 agora. Plano de 5-8 dias.
- **(B) Aprovar com ajustes** — me diga quais.
- **(C) Cortar mais escopo** (ex: também cortar exclusão "modo ORDER" pra simplificar).
- **(D) Pausar SPEC-005 por X dias** e fazer outra coisa.
- **(E) Atalho cirúrgico** (Caminho B do chat anterior: você roda SQL + remerge SPEC-005 direto sem o resto). **Não recomendo após esta análise** — expõe R3, R5, R10, R11, R12, R14, R17, R20.

---

**Este documento foi revisado por dois agentes independentes (arquiteto + security-architect). Todas as 13 lacunas identificadas por eles foram incorporadas. Sem essas correções, o ADR teria sido teatro de segurança.**
