# Fase 04 — Admin operacional

> Objetivo: dar ao operador da loja o que ele precisa para tocar o dia-a-dia sem entrar no banco.

## Escopo

1. **Dashboard de KPIs** (`/admin`)
2. **CRUD de cupons** (`/admin/cupons`)
3. **Drill-down de cliente** (ver pedidos do cliente direto)
4. **Webhook de tracking** (Melhor Envio atualiza `trackingCode` automaticamente)
5. **Filtro avançado de pedidos** (por status, data, valor, cliente)
6. **Refund flow** (cancelar pedido pago + reembolsar via MP)

---

## 1. Dashboard `/admin`

### Métricas mínimas
- **Vendas hoje** (count + valor) — `Order.createdAt = today`
- **Vendas no mês** vs mês anterior (% diff)
- **Ticket médio** dos últimos 30 dias
- **Pedidos pendentes** (status = `pending_payment`) — call to action
- **Pedidos pagos não enviados** (`status = paid AND fulfillmentStatus = pending`) — call to action
- **Top 5 produtos vendidos** (mês corrente)

### Endpoint
- `GET /api/admin/stats` (admin only)
- Retorna agregados pré-calculados, cache em memória 60s para evitar agg pesadas

### Frontend
- Substitui o `app/admin/page.tsx` atual
- Cards grandes com números, gráfico simples (sparkline) — pode usar SVG inline para evitar dependência

---

## 2. CRUD de cupons (`/admin/cupons`)

Modelo `Coupon` já existe ([prisma/schema.prisma:233](../../../prisma/schema.prisma:233)).

### Endpoints
- `GET /api/cupons` — lista
- `POST /api/cupons` — cria
- `PUT /api/cupons` — atualiza
- `DELETE /api/cupons?id=X` — apaga

### Telas
- `/admin/cupons` (lista) — tabela com código, tipo, valor, validade, usos
- `/admin/cupons/novo` e `/admin/cupons/[id]/editar` — form

### Form fields
- `code` (input texto, validar único) — convertido para uppercase
- `type` select: `fixed` | `percentage`
- `value` (number) — se percentage, validar 1-100
- `minSubtotal` (number, opcional)
- `startsAt` / `endsAt` (datetime-local)
- `usageLimit` (number, opcional)
- `isActive` (checkbox)

---

## 3. Drill-down de cliente

A página `/admin/clientes` já lista clientes (provavelmente). Estender:

- Click em cliente abre `/admin/clientes/[id]` com:
  - Dados pessoais
  - Endereços (Fase 2)
  - Pedidos (lista com totais, link para detalhe admin)
  - LTV (lifetime value): soma de pedidos pagos
  - Última compra

### Endpoints
- `GET /api/clientes/[id]` (admin) — retorna cliente + agregados

---

## 4. Webhook de tracking (Melhor Envio)

Hoje `trackingCode` é digitado manualmente no admin. Melhor Envio expõe webhook de eventos do envio.

### Endpoint novo
`POST /api/webhooks/melhorenvio`

Eventos a tratar:
- `posted` → `Order.fulfillmentStatus = 'shipped'`, salva `Shipment.trackingCode`
- `delivered` → `Order.fulfillmentStatus = 'delivered'`
- `cancelled` → marcar Shipment como cancelado (não cancela Order)

Reaproveitar padrão de idempotência via `WebhookEvent` ([app/api/webhooks/mercadopago/route.ts](../../../app/api/webhooks/mercadopago/route.ts)).

### Configuração
- Documentar no `docs/implementation/setup-melhorenvio-webhook.md` (criar) como configurar URL no painel MelhorEnvio
- ENV nova: `MELHORENVIO_WEBHOOK_SECRET`

---

## 5. Filtro avançado de pedidos

Estender `/admin/pedidos`:

- Filtros: status, data inicial, data final, busca por nome/email/orderNumber
- Ordenação: por data (asc/desc), por valor
- Exportar CSV (botão simples server-side: gera CSV em memória, retorna como download)

### Endpoint
- `GET /api/pedidos?status=&from=&to=&q=&sort=` — admin only

---

## 6. Refund flow

### Endpoint
- `POST /api/admin/orders/[orderNumber]/refund` body `{ reason }` (admin)
  - Chama MP `POST /v1/payments/{id}/refunds`
  - Atualiza `Order.status = 'refunded'`, `Payment.status = 'refunded'`
  - Reverte `Coupon.usedCount` se aplicável
  - Envia e-mail ao cliente

### UI no admin
- Em `/admin/pedidos/[id]`, botão "Reembolsar" (só se `paymentStatus = 'paid'`)
- Modal pede motivo + confirmação
- Após sucesso, atualiza status na tela

---

## Arquivos a criar/modificar

| Tipo | Caminho |
|---|---|
| ✏️ | `app/admin/page.tsx` (dashboard) |
| 🆕 | `app/api/admin/stats/route.ts` |
| 🆕 | `app/admin/cupons/page.tsx` |
| 🆕 | `app/admin/cupons/novo/page.tsx` |
| 🆕 | `app/admin/cupons/[id]/editar/page.tsx` |
| 🆕 | `app/api/cupons/route.ts` |
| ✏️ | `app/admin/clientes/page.tsx` (drill-down) |
| 🆕 | `app/admin/clientes/[id]/page.tsx` |
| 🆕 | `app/api/clientes/[id]/route.ts` |
| 🆕 | `app/api/webhooks/melhorenvio/route.ts` |
| ✏️ | `app/admin/pedidos/page.tsx` (filtros) |
| 🆕 | `app/api/admin/orders/[orderNumber]/refund/route.ts` |
| ✏️ | `lib/database.ts` (queries de stats) |
| ✏️ | `lib/payment.ts` (função `refundPayment`) |
| 🆕 | `docs/implementation/setup-melhorenvio-webhook.md` |

## Critérios de aceite

- [ ] Dashboard carrega com stats reais em < 1s
- [ ] Vendas hoje conta apenas pedidos pagos (não pendentes)
- [ ] Cupom criado funciona no checkout (Fase 3) e desativar funciona
- [ ] Cliente drill-down mostra todos os pedidos do email
- [ ] Webhook MelhorEnvio recebe e processa evento sem duplicar (idempotência)
- [ ] Filtro de pedidos retorna paginado
- [ ] Refund chama API real do MP e atualiza status

## Riscos

- **Performance dashboard:** queries agregadas crescem O(N pedidos). Cache 60s + considerar materialized views se passar 50k pedidos.
- **Refund parcial:** MP suporta. Versão 1: só reembolso total. Documentar limitação.
- **Webhook MelhorEnvio:** API deles tem mudado bastante. Validar contrato atual antes de implementar.
