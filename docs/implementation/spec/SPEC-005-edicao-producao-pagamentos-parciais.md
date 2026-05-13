# SPEC-005 — Edição/Exclusão na Lista de Produção + Pagamentos Parciais

> Versão: 1.1 | Data: 2026-05-13 | Status: Aprovado para implementação
>
> **Changelog 1.0 → 1.1:** Stakeholder aprovou as 4 decisões pendentes da seção 9.
> Adicionado conceito de `Order.createdVia` (origem do pedido) que governa
> notificações ao cliente e visibilidade na conta. Estorno automático via MP
> definido para pedidos 100% MP cancelados.

## 1. Resumo executivo (linguagem do dono do negócio)

Hoje o admin consegue marcar tarefas de produção como concluídas, mas **não consegue
excluí-las nem editar o item original** sem voltar para a tela do pedido. Também não
existe forma de registrar **pagamentos parciais** (ex.: cliente paga metade no fechamento
do pedido em PIX/dinheiro e a outra metade na retirada).

Este documento propõe:

1. **Excluir/Editar item da produção** com 3 modos de exclusão (cancelar só o item,
   cancelar o pedido inteiro, ou só tirar da fila), e edição completa do item
   (quantidade, customização) direto do contexto da produção.
2. **Pagamentos parciais manuais**: admin registra cada pagamento recebido (valor,
   método, data, observação). O sistema calcula saldo devido, libera retirada só
   quando 100% pago, e mantém auditoria completa.

**O que o cliente final vê:** lista de pagamentos feitos e saldo em aberto na conta
dele. **O que o admin ganha:** controle preciso sobre fila de produção e fluxo de
caixa de pedidos retirados na loja.

---

## 2. Estado atual confirmado

| Área | Atual | Lacuna |
| --- | --- | --- |
| Lista de produção (`/admin/producao`) | `PATCH /api/producao/[id]` permite alterar status, prazo, prioridade, quantidade produzida, notas | Não tem DELETE; sem UI para editar quantidade pedida / customização do `OrderItem` |
| Edição de pedido (`/admin/pedidos/[id]`) | PATCH cobre status, paymentStatus, itens, endereço, tracking | Existe, mas operador precisa sair da tela de produção, perder contexto, recalcular ProductionTask manualmente |
| Pagamentos | Tabela `Payment` 1:1 com `Order`, acoplada ao Mercado Pago | Não suporta múltiplos recebimentos; não há campo `paidAmount/dueAmount`; não há fluxo manual de registrar dinheiro/PIX direto |
| Pipeline | `paymentStatus` ∈ {pending, paid, rejected, failed, cancelled, refunded} | Não tem estado `partial`; auto-transição assume 100% pago |
| Auditoria | `AuditLog` registra ação + ator | OK, será reutilizado |

---

## 3. Decisões arquiteturais

### 3.1 Feature A — Editar/Excluir item da produção

#### 3.1.1 Edição

**Decisão:** Reutilizar o que já existe, não duplicar lógica.

- Botão "Editar produção" → mantém o PATCH atual `/api/producao/[id]` (status, prazo,
  prioridade, quantidade produzida, notas).
- Botão "Editar item original" → abre modal que chama `PATCH /api/pedidos/[orderId]`
  com o subconjunto de campos do `OrderItem`: `quantity`, `unitPrice`,
  `personalizationJson` (textos, cores etc.), `productNameSnapshot` (raramente).
- A `ProductionTask` é **automaticamente sincronizada**: alterar `OrderItem.quantity`
  recalcula `ProductionTask.totalQuantity`. Já existe gatilho via
  `order-production-bridge.ts`; precisamos confirmar que ele cobre updates (não só
  create).

**Gap a confirmar:** se o bridge atual não atualiza a task quando o OrderItem muda,
precisamos adicionar isso no PATCH de pedidos (em transação).

#### 3.1.2 Exclusão — 3 modos

**Decisão:** Um endpoint único com parâmetro `mode`, UI com modal de confirmação que
explica o impacto.

```
DELETE /api/producao/[id]?mode=ITEM_ONLY|ORDER|TASK_ONLY
Body: { reason: string (obrigatório), confirmCascade: boolean }
```

| Modo | O que acontece | Estado final |
| --- | --- | --- |
| `TASK_ONLY` | Marca `ProductionTask.status='cancelled'`. `OrderItem` e `Order` intactos. | Tarefa some da fila; item continua no pedido |
| `ITEM_ONLY` | Soft-delete do `OrderItem` (novo campo `deletedAt`). Cancela `ProductionTask`. Recalcula `Order.subtotal/total`. Se já houve pagamento ≥ novo total → registra `PaymentInstallment` virtual com `isRefund=true, status='pending_refund'` pelo valor excedente. | Pedido continua aberto com menos itens; pode gerar saldo a estornar |
| `ORDER` | Cancela TODOS `OrderItem` (soft-delete), TODAS `ProductionTask`. `Order.status='cancelled'`, `fulfillmentStatus='cancelled'`. Se pago → `paymentStatus='refunded'` + indicador de estorno pendente. Dispara email opcional ao cliente. | Pedido encerrado |

**Por que soft-delete em `OrderItem`?** Histórico e auditoria. Se o cliente reclamar,
precisamos saber o que tinha no pedido antes. Filtros de listagem ignoram itens com
`deletedAt != null`.

**Regra de negócio:** mesmo no modo `TASK_ONLY` precisa de `reason` (texto livre,
mín. 5 caracteres). Vai para `AuditLog.metadata.reason`.

#### 3.1.3 UI

```
┌──────────────────────────────────────────────────────────┐
│ Tarefa #42 — Produto X (Pedido #1234)                    │
│  Status: in_production    Prazo: 20/05    Qtd: 2/3       │
│                                                          │
│  [Avançar status] [Editar produção] [Editar item original]│
│                                            [🗑 Excluir]   │
└──────────────────────────────────────────────────────────┘

  Click em [🗑 Excluir] abre:

┌──────────────────────────────────────────────────────────┐
│ O que você quer fazer?                                   │
│                                                          │
│  ○ Só tirar da fila de produção                          │
│    Mantém o item no pedido. Use se a tarefa foi criada   │
│    por engano ou será produzida em outro lugar.          │
│                                                          │
│  ○ Cancelar este item do pedido                          │
│    Remove o item. Pedido continua com os outros itens.   │
│    Total recalculado: R$ 240 → R$ 180                    │
│    ⚠ Já foi pago R$ 240 — saldo a estornar: R$ 60        │
│                                                          │
│  ○ Cancelar o pedido inteiro                             │
│    ⚠ Vai cancelar 3 itens. Total: R$ 240.                │
│    Já pago: R$ 120 — saldo a estornar: R$ 120            │
│    □ Notificar cliente por email                         │
│                                                          │
│  Motivo (obrigatório):                                   │
│  [_____________________________________________________] │
│                                                          │
│                              [Cancelar] [Confirmar]      │
└──────────────────────────────────────────────────────────┘
```

---

### 3.2 Feature B — Pagamentos parciais (manuais)

#### 3.2.1 Modelo de dados

**Decisão:** Criar tabela `PaymentInstallment` separada. **NÃO refatorar `Payment`**.

Justificativa:
- `Payment` está acoplado a `provider`, `providerPaymentId`, `rawPayload` do Mercado
  Pago. Refatorar para 1:N quebraria o webhook (alto risco, considerando o
  incidente de 2026-05-13).
- `PaymentInstallment` é aditivo — coexiste com `Payment`. Em pedidos 100% MP,
  `Payment` continua sendo a fonte da verdade e o webhook cria 1 installment
  automático refletindo o `Payment.amount`.

```prisma
model PaymentInstallment {
  id              String   @id @default(cuid())
  orderId         String
  order           Order    @relation(fields: [orderId], references: [id])

  sequence        Int                 // 1, 2, 3... ordem cronológica
  amount          Decimal  @db.Decimal(10, 2)
  method          String              // 'cash' | 'pix_manual' | 'bank_transfer' | 'mercadopago' | 'other'
  description     String?             // ex: "Entrada PIX 13/05", "Retirada em dinheiro"
  receivedAt      DateTime
  receivedByEmail String              // admin que registrou (ou 'system' p/ MP)
  notes           String?
  isRefund        Boolean  @default(false)
  paymentId       String?             // FK opcional para Payment (quando vem do MP)
  payment         Payment? @relation(fields: [paymentId], references: [id])

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([orderId, sequence])
  @@index([receivedAt])
}
```

**Campos novos em `Order`:**

```prisma
paidAmount      Decimal  @db.Decimal(10, 2) @default(0)
dueAmount       Decimal  @db.Decimal(10, 2) @default(0)
```

Persistidos (não computed) para permitir filtros/ordenação na listagem do admin.
Atualizados em transação a cada `PaymentInstallment` criado/alterado/removido.

**Novo valor em `paymentStatus`:** `'partial'` — quando `0 < paidAmount < total`.

#### 3.2.2 Endpoints

```
POST   /api/pedidos/[id]/installments
  Body: { amount, method, description?, receivedAt?, notes?, isRefund? }
  Cria PaymentInstallment, atualiza Order.paidAmount/dueAmount/paymentStatus.
  Se paidAmount >= total → paymentStatus='paid', dispara autoTransitionOnPayment.

GET    /api/pedidos/[id]/installments
  Lista installments do pedido, ordenados por sequence.

PATCH  /api/pedidos/[id]/installments/[installmentId]
  Corrige valor/data/método. Recalcula Order.paidAmount.

DELETE /api/pedidos/[id]/installments/[installmentId]
  Soft-delete (`deletedAt`). Recalcula Order.paidAmount.
  Body: { reason: string (obrigatório) }
```

**Todas as 4 rotas:**
- Requerem `requireApiAdmin()`.
- Gravam `AuditLog`.
- Executam dentro de `prisma.$transaction` com lock em `SELECT ... FOR UPDATE` na
  `Order` para evitar race entre dois admins.

#### 3.2.3 Pipeline impactado

Estados de `paymentStatus`:

```
                          ┌─────────────┐
                          │   pending   │  (pedido novo, nada pago)
                          └──────┬──────┘
                                 │
            registra 1ª parcela com amount < total
                                 │
                                 ▼
                          ┌─────────────┐
                          │   partial   │  (NOVO)
                          └──────┬──────┘
                                 │
              registra parcelas até atingir total
                                 │
                                 ▼
                          ┌─────────────┐
                          │    paid     │  → dispara autoTransitionOnPayment
                          └─────────────┘
```

**Regra crítica:** o botão "Confirmar retirada" (transição
`ready_to_pickup` → `picked_up`) **bloqueia se `dueAmount > 0`**. UI mostra:

```
⚠ Cliente ainda deve R$ 60. Registre o pagamento antes de confirmar a retirada.
[Registrar pagamento agora]   [Confirmar mesmo assim*]

* Confirmar com saldo aberto requer justificativa e é logado como exceção.
```

A opção "Confirmar mesmo assim" existe para resolver casos legítimos (admin esqueceu
de registrar antes), mas vira evento `payment.exception` no audit log.

#### 3.2.4 UI no admin

Nova seção dentro de `/admin/pedidos/[id]`:

```
┌── Pagamentos ────────────────────────────────────────────┐
│  Total do pedido:           R$ 480,00                    │
│  Pago:                      R$ 240,00  (50%)             │
│  Saldo devido:              R$ 240,00                    │
│  Status: ● Parcialmente pago                             │
│                                                          │
│  Histórico:                                              │
│  ┌────────────────────────────────────────────────────┐  │
│  │ #1 13/05/2026  R$ 240,00  PIX direto               │  │
│  │     "Entrada via PIX para conta XPTO" — eduardo@…  │  │
│  │     [Editar] [Remover]                             │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│                              [+ Registrar pagamento]     │
└──────────────────────────────────────────────────────────┘

  Click em [+ Registrar pagamento] abre:

┌──────────────────────────────────────────────────────────┐
│ Registrar pagamento                                      │
│                                                          │
│ Valor:        [R$ _________]   Saldo atual: R$ 240,00    │
│ Método:       (●) Dinheiro                               │
│               ( ) PIX direto                             │
│               ( ) Transferência bancária                 │
│               ( ) Outro                                  │
│ Recebido em:  [13/05/2026]                               │
│ Descrição:    [_______________________________________]  │
│ Observações:  [_______________________________________]  │
│                                                          │
│ ☐ Marcar como estorno (saldo a devolver ao cliente)      │
│                                                          │
│                              [Cancelar] [Registrar]      │
└──────────────────────────────────────────────────────────┘
```

#### 3.2.5 UI no cliente (`/minha-conta/pedidos/[id]`)

Adicionar bloco "Pagamentos":

```
Pagamentos
  Total: R$ 480,00     Pago: R$ 240,00     Saldo: R$ 240,00

  ✓ 13/05/2026 — R$ 240,00 — PIX (Entrada)
  ⏳ Saldo a pagar na retirada: R$ 240,00
```

Sem detalhe de método interno nem nome de admin — só o que é relevante para o cliente.

---

## 4. Diagrama do fluxo (após mudanças)

```
                    Cliente fecha pedido
                    deliveryMethod=pickup
                            │
                            ▼
              ┌────────────────────────────┐
              │ Order criada               │
              │ paymentStatus=pending      │
              │ paidAmount=0  dueAmount=T  │
              └─────────────┬──────────────┘
                            │
              admin registra entrada (50%)
                            │
                            ▼
              ┌────────────────────────────┐
              │ paymentStatus=partial      │
              │ paidAmount=T/2 dueAmount=T/2│
              │ autoTransition → na_fila   │ ◄── nova regra:
              └─────────────┬──────────────┘     produção pode
                            │                    começar com
                            │                    parcial (configurável)
                            ▼
              ┌────────────────────────────┐
              │ ProductionTask criada      │
              │ (1 por OrderItem)          │
              └─────────────┬──────────────┘
                            │
                  produção avança normalmente
                            │
                            ▼
              ┌────────────────────────────┐
              │ fulfillmentStatus=         │
              │ ready_to_pickup            │
              └─────────────┬──────────────┘
                            │
                  cliente chega para retirar
                            │
                            ▼
              ┌────────────────────────────┐
              │ admin registra 2ª parcela  │
              │ paidAmount=T  dueAmount=0  │
              │ paymentStatus=paid         │
              └─────────────┬──────────────┘
                            │
                            ▼
              ┌────────────────────────────┐
              │ admin clica "Confirmar     │
              │ retirada" (agora liberado) │
              │ fulfillmentStatus=         │
              │ picked_up                  │
              └────────────────────────────┘
```

**Regra de pagamento × produção:** admin pode avançar a produção em **qualquer**
estado de pagamento (decisão §9.4). Não há trava entre `paymentStatus` e
`fulfillmentStatus` no caminho de avanço. A única trava é em `picked_up`, que
exige `dueAmount = 0` (com escape consciente para casos legítimos).

---

## 5. Trade-offs

| # | Decisão | Alternativa considerada | Por que escolhi |
| --- | --- | --- | --- |
| 1 | `PaymentInstallment` separada de `Payment` | Refatorar `Payment` para 1:N | Webhook MP está acoplado a `Payment` 1:1. Refatorar é alto risco — o incidente de maio mostrou que mexer em fluxo de pagamento sem rede precisa ser muito conservador. Installment é aditivo. |
| 2 | `paidAmount/dueAmount` persistidos em `Order` | Computar on-the-fly via SUM | Listagem de pedidos no admin precisa filtrar e ordenar por isso. SUM por query no N+1 mata performance. Trade-off: mais código para manter consistência (mitigado por transação + lock). |
| 3 | DELETE de produção com 1 endpoint + `?mode=` | 3 endpoints distintos | Mais semântico, mas duplica 80% da validação. Um endpoint com enum de modo é OK e a UI é quem orienta. |
| 4 | Soft-delete em `OrderItem` (novo campo `deletedAt`) | Hard-delete | Histórico é crítico em pedidos — auditoria, suporte, reclamação. Soft-delete custa 1 índice extra e um filtro `WHERE deletedAt IS NULL` nos lugares certos. Vale a pena. |
| 5 | Sem integração MP para pagamentos manuais | Adicionar fluxo "MP gera link da parcela" | Stakeholder definiu manual. Escopo enxuto reduz risco. Pode ser fase futura. |
| 6 | Permite produção iniciar com `partial` (configurável) | Exigir `paid` para produzir | Cenário real: cliente paga 50% e quer começar a produção. Forçar 100% antes prejudica o caso de uso. Mas botão "Confirmar retirada" SEMPRE exige 100% (com escape consciente). |
| 7 | Cancelar item gera "saldo a estornar" mas não estorna automático | Auto-refund via MP | Manual é mais seguro: admin precisa confirmar fisicamente. MP só permite estorno automático em janela limitada e nem sempre é via MP que veio o dinheiro. |

---

## 6. Plano de migração (faseado, com backout claro)

### Fase 1 — Schema (PR pequeno, low-risk)

- Migration `add_payment_installments_and_partial`:
  - Cria tabela `PaymentInstallment`.
  - Adiciona `Order.paidAmount`, `Order.dueAmount`, `OrderItem.deletedAt`.
  - Backfill: para Orders com `paymentStatus='paid'`, `paidAmount=total`, `dueAmount=0`.
    Para os demais, `paidAmount=0`, `dueAmount=total`.
  - Adiciona valor `'partial'` no enum (string livre — não há check constraint hoje).
- Sem alteração funcional. Deploy sozinho, valida em produção.
- **Risco:** baixo. Backfill é idempotente.
- **Backout:** drop coluna / drop tabela. Não há dados produzidos ainda.

### Fase 2 — Backend (PR médio)

- `lib/installments.ts` — funções `createInstallment`, `updateInstallment`,
  `deleteInstallment`, `recalculateOrderTotals` (em transação com lock).
- Endpoints `POST/GET/PATCH/DELETE /api/pedidos/[id]/installments[/[installmentId]]`.
- Endpoint `DELETE /api/producao/[id]?mode=...`.
- Ajustar `order-production-bridge.ts` para sincronizar task quando `OrderItem` muda.
- Ajustar `autoTransitionOnPayment` para considerar `'partial'`.
- Testes unitários + integração para cada modo de DELETE e para concorrência de
  installments.
- **Backout:** feature flag `INSTALLMENTS_ENABLED` que desliga UI sem reverter
  endpoints.

### Fase 3 — Frontend admin (PR médio)

- Componente `OrderPaymentsSection` em `/admin/pedidos/[id]`.
- Modal `RegisterInstallmentModal`.
- Modal `DeleteProductionTaskModal` (3 modos).
- Bloqueio do botão "Confirmar retirada" quando `dueAmount > 0`.
- **Backout:** flag desliga seções e mantém UI anterior.

### Fase 4 — Frontend cliente + polimento

- Bloco "Pagamentos" em `/minha-conta/pedidos/[id]` — **apenas pedidos com
  `createdVia='site'`** (§9.3); pedidos admin nunca aparecem aqui.
- Email ao quitar pedido / mudar fase — **apenas pedidos com `createdVia='site'`**
  (§9.2); pedidos admin são silenciosos.
- Filtros novos na listagem admin: "Com saldo devido" / "Totalmente pago" /
  "Origem: site/admin".
- Endpoint `POST /api/pedidos/[id]/refund-mp` para estorno via MP (§9.5).

---

## 7. Riscos e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
| --- | --- | --- | --- |
| Race condition (2 admins registrando ao mesmo tempo) | Baixa | Alto (saldo inconsistente) | `prisma.$transaction` com `SELECT ... FOR UPDATE` no `Order` antes de recalcular |
| Admin registra valor errado | Alta | Médio (cliente reclama) | PATCH + DELETE de installment com audit + alerta visual se ultrapassa total |
| Migration não aplica em prod (revivendo incidente) | Baixa | Alto | Migration em PR isolado, aplicada via `start.mjs` e validada antes do PR2; sem fallback silencioso (já existe trava de produção pós-incidente) |
| Webhook MP cria installment duplicado | Média | Médio | Idempotência por `paymentId`: webhook só cria installment se não existir um com mesmo `paymentId` |
| Soft-delete vazando em listagens | Média | Médio | Adicionar filtro `deletedAt: null` em TODA query de OrderItem; lint regra pode ajudar |
| Cliente vê pagamento que admin registrou errado | Média | Baixo | Cliente vê o que está confirmado no banco. Se admin edita, cliente vê valor correto (correto pra rastreabilidade) |

---

## 8. Suposições assumidas

- **"Editar completamente"** = poder editar dados do `OrderItem` (quantidade,
  customização) E dados de produção (prazo, status, prioridade) sem sair da tela
  de produção. Cada um abre seu modal e chama o endpoint apropriado.
- **Reembolso** após exclusão de item já pago é registrado como pendência (texto +
  flag `isRefund`) — o estorno físico (MP, dinheiro, transferência) é feito pelo
  admin manualmente fora do sistema.
- **Pagamentos parciais não geram nota fiscal automática.** Admin pode anexar nota
  em `notes` se quiser.
- **Limite de parcelas:** sem limite técnico, mas UI alerta "muitas parcelas (4+),
  confira se está correto".

---

## 9. Decisões do stakeholder (aprovadas 2026-05-13)

Regra-mestra: **pedido criado pelo admin é uma operação interna** (loja física,
WhatsApp, encomenda por telefone, etc.) — sem cliente cadastrado do outro lado.
Pedido criado pelo site é uma transação com um cliente real, que tem conta e
expectativa de comunicação. As 4 decisões abaixo derivam dessa distinção.

### 9.1 Origem do pedido — novo campo `Order.createdVia`

Não existe hoje. Adicionar:

```prisma
createdVia String @default("site")  // 'site' | 'admin'
```

- `/api/orders` (público) → preenche `createdVia='site'` automaticamente.
- `/api/pedidos` (admin POST) → preenche `createdVia='admin'`.
- Backfill da migration: pedidos existentes recebem `'site'` (comportamento
  conservador — quem já estava na base provavelmente veio do checkout público;
  caso o time identifique exceções, corrige por SQL pontual após o deploy).

Esse campo passa a ser **a chave** que governa as decisões 9.2, 9.3 e 9.4.

### 9.2 Email para o cliente — APROVADO COM RESTRIÇÃO

Disparar email **apenas se `Order.createdVia === 'site'`**. Pedidos com
`createdVia === 'admin'` são silenciosos: nenhuma comunicação automatizada
(criação, parcial, quitação, cancelamento, mudança de fase). Admin se comunica
com o cliente fora do sistema (WhatsApp, telefone, balcão).

Implementação:
- Em `lib/order-notifications.ts` (e equivalentes), adicionar guarda no topo:
  `if (order.createdVia === 'admin') return { skipped: true, reason: 'admin_created' }`.
- Vale para **TODOS** os emails atuais — não só os de pagamento. A regra é
  global pra pedidos admin.
- Auditoria: registrar `notification.skipped` quando o gate corta para
  rastreabilidade.

### 9.3 Visibilidade na conta do cliente — APROVADO COM RESTRIÇÃO

Pedidos `createdVia === 'admin'` **não aparecem em `/minha-conta/pedidos`**
mesmo que tenham `customerEmail` coincidente com uma conta cadastrada.

Justificativa do stakeholder: esses pedidos foram lançados pelo admin para
clientes que não estão necessariamente cadastrados; mostrar na conta criaria
expectativa de auto-serviço (cancelar, ver pagamentos parciais, etc.) que não
existe nesse fluxo.

Implementação:
- Query de `/minha-conta/pedidos` adiciona filtro `WHERE createdVia = 'site'`.
- Se mais tarde quisermos relaxar (ex: cliente cadastrado vê o pedido manual
  que admin criou no nome dele), basta remover o filtro — sem mudança de
  schema.

### 9.4 Pagamento parcial libera produção — APROVADO E RELAXADO

Decisão final: **admin escolhe livremente**. Pode iniciar produção com 0%
pago, 50% pago, 100% pago — não há trava de pagamento para entrar em
produção. O único momento que o sistema bloqueia é a transição para
`picked_up` (vide §3.2.3 — "Confirmar retirada" exige `dueAmount=0`, com
escape consciente).

Implementação:
- A config `PRODUCTION_REQUIRES_FULL_PAYMENT` proposta na §4 **não é
  necessária**. Remover do escopo.
- `autoTransitionOnPayment` continua avançando o pedido quando `paid`, mas o
  admin pode forçar manualmente o avanço de fase em qualquer estado de
  pagamento (já é o comportamento atual do PATCH de `fulfillmentStatus`).
- UI da tela de produção mostra um badge discreto "Sem pagamento" / "Pago
  parcial (R$ X de Y)" / "Pago integral" para dar contexto ao operador, mas
  não bloqueia ação.

### 9.5 Estorno automático em cancelamento — APROVADO COM ESCOPO RESTRITO

Estorno automático via API do Mercado Pago **APENAS** quando:
- `Order.createdVia` pode ser qualquer um (site ou admin), MAS
- `Order.paymentStatus === 'paid'` e o pagamento veio 100% do MP (`Payment`
  existe e cobre o `Order.total`), E
- Não existem `PaymentInstallment` manuais com `isRefund=false` (ou seja, o
  pedido nunca teve pagamento parcial fora do MP).

Pelo critério do stakeholder: **"não teremos pedidos pagos via MP
parcialmente"** — ou seja, MP é sempre 100% ou nada. Isso simplifica a
detecção: se `Payment.amount === Order.total` e `Payment.status === 'paid'`,
o pedido é 100% MP e elegível para estorno automático.

Implementação:
- Quando admin escolhe "Cancelar pedido inteiro" (modo `ORDER` do DELETE):
  - Sistema detecta automaticamente se o pedido é 100% MP.
  - Se sim: UI mostra "Estornar R$ X via Mercado Pago?" — botão dispara
    `POST /v1/payments/{providerPaymentId}/refunds` no MP.
  - Se não (parcial manual, dinheiro, PIX direto, etc.): UI mostra apenas
    "Reembolso pendente: R$ X" como indicador, admin faz o estorno fora do
    sistema e registra um `PaymentInstallment` com `isRefund=true`.
- Caso o refund do MP falhe (timeout, erro de API, fora da janela permitida
  pelo MP): cancelamento do pedido segue normalmente, mas o status do
  estorno fica como `refund_failed` com a mensagem de erro, e o admin é
  alertado para fazer manual.
- Nova função `lib/payment.ts::refundMercadoPagoPayment(orderId, reason)`.
- Novo endpoint `POST /api/pedidos/[id]/refund-mp` (chamado pelo DELETE do
  pedido em modo `ORDER` e também disponível avulso para casos de admin que
  decida estornar sem cancelar o pedido).

---

## 9-bis. Resumo das mudanças de schema decorrentes das decisões

```prisma
model Order {
  // ... campos existentes ...
  createdVia    String   @default("site")        // [+] §9.1
  paidAmount    Decimal  @db.Decimal(10, 2) @default(0)  // [+] §3.2.1
  dueAmount     Decimal  @db.Decimal(10, 2) @default(0)  // [+] §3.2.1
  refundStatus  String?                          // [+] §9.5 — null | 'pending' | 'requested' | 'refunded' | 'failed'
}

model OrderItem {
  // ... campos existentes ...
  deletedAt     DateTime?                        // [+] §3.1.2
}

model PaymentInstallment { ... }                  // [+] §3.2.1 (íntegra)
```

---

## 10. O que eu revisitaria conforme o sistema cresce

- **Editor inline na tela de produção** (sem modal): se o operador edita muito
  item original, modal vira atrito. Avaliar após 30 dias de uso.
- **Reembolso automático via MP:** se o volume de cancelamentos crescer, vale a
  integração para reduzir trabalho manual.
- **Conciliação bancária:** registrar conta de destino (PIX, banco) em cada
  installment para conciliar com extrato no fim do mês.
- **Múltiplos métodos por installment:** hoje 1 installment = 1 método. Se um
  cliente pagar R$ 100 metade dinheiro / metade PIX, hoje precisamos registrar 2
  installments — pode virar ergonômico ter um único registro com split.
- **Limite ou aprovação para "Confirmar mesmo assim" com saldo aberto:** se essa
  exceção começar a ser usada com frequência, é sinal de problema operacional —
  pode ganhar bloqueio por aprovação de gerente.

---

## Apêndice — Resumo de arquivos a tocar

```
prisma/schema.prisma                                  [+] tabela, campos
prisma/migrations/.../migration.sql                   [+] migration (createdVia,
                                                          paidAmount, dueAmount,
                                                          deletedAt, refundStatus,
                                                          PaymentInstallment)

lib/installments.ts                                   [+] novo
lib/order-production-bridge.ts                        [~] sync em update
lib/order-statuses.ts                                 [~] aceitar 'partial'
lib/payment.ts                                        [~] cria installment via webhook;
                                                          nova fn refundMercadoPagoPayment
lib/order-notifications.ts                            [~] guard createdVia==='admin'

app/api/orders/route.ts                               [~] setar createdVia='site'
app/api/pedidos/route.ts                              [~] setar createdVia='admin'
app/api/pedidos/[id]/installments/route.ts            [+] POST, GET
app/api/pedidos/[id]/installments/[installmentId]/route.ts  [+] PATCH, DELETE
app/api/pedidos/[id]/refund-mp/route.ts               [+] POST (estorno MP §9.5)
app/api/producao/[id]/route.ts                        [~] adicionar DELETE
app/api/pedidos/[id]/route.ts                         [~] tratar deletedAt em items;
                                                          chamar refund se modo ORDER

app/admin/pedidos/[id]/page.tsx                       [~] nova seção pagamentos
app/admin/pedidos/[id]/_components/OrderPaymentsSection.tsx  [+]
app/admin/pedidos/[id]/_components/RegisterInstallmentModal.tsx  [+]
app/admin/producao/_components/DeleteProductionTaskModal.tsx     [+]
app/admin/producao/_components/EditOrderItemModal.tsx            [+]

app/minha-conta/pedidos/page.tsx                      [~] filtro createdVia='site'
app/minha-conta/pedidos/[id]/page.tsx                 [~] bloco pagamentos +
                                                          404 se createdVia='admin'

docs/implementation/spec/SPEC-005-*.md                [+] este doc
docs/implementation/adr/ADR-003-payment-installments.md  [+] decisão arquitetural
```

---

**Próximo passo:** abrir Fase 1 (schema + migration com `createdVia`,
`paidAmount`, `dueAmount`, `deletedAt`, `refundStatus`, `PaymentInstallment`)
como PR isolado, com backfill `createdVia='site'` para pedidos legados, e
deploy controlado conforme processo pós-incidente de 2026-05-13.
