# Glossário de domínio

| Termo (negócio) | Termo (técnico) | Onde |
|---|---|---|
| Cliente | `Customer` (modelo Prisma) ou `SessionUser` (sessão) | `prisma/schema.prisma:57`, `lib/auth.ts:12` |
| Admin / operador | `AdminUser` (modelo) com `role` em `customer\|support\|orders_manager\|catalog_manager\|admin\|owner\|global_admin` | `lib/auth.ts:10` |
| Pedido | `Order` | `prisma/schema.prisma:147` |
| Item do pedido | `OrderItem` | `prisma/schema.prisma:174` |
| Endereço de entrega do pedido | `Address` (1:1 com Order) | `prisma/schema.prisma:190` |
| Endereço salvo do cliente | `CustomerAddress` (a criar — Fase 2) | — |
| Pagamento | `Payment` (1:1 com Order) | `prisma/schema.prisma:204` |
| Envio / postagem | `Shipment` (1:1 com Order) | `prisma/schema.prisma:219` |
| Cupom de desconto | `Coupon` | `prisma/schema.prisma:233` |
| Banner do hero | `Banner` | `prisma/schema.prisma:67` |
| Categoria | `Category` | `prisma/schema.prisma:9` |
| Produto | `Product` | `prisma/schema.prisma:23` |
| Variação do produto | `ProductVariant` | `prisma/schema.prisma:90` |
| Imagem do produto | `ProductImage` | `prisma/schema.prisma:80` |
| Campo de personalização | `PersonalizationField` | `prisma/schema.prisma:111` |
| Carrinho | `Cart` + `CartItem` (modelo existe mas **não é usado** hoje — carrinho vive em Context React) | `prisma/schema.prisma:125` + `context/CartContext.tsx` |
| Código OTP por e-mail | `AuthCode` | `prisma/schema.prisma:255` |
| Evento de webhook | `WebhookEvent` (idempotência) | `prisma/schema.prisma:268` |
| Wishlist / favoritos | `Wishlist` (a criar — Fase 3) | — |
| Token de reset de senha | `PasswordResetToken` (a criar — Fase 3) | — |

## Status de pedido (`Order.status`)

| Valor | Significado |
|---|---|
| `pending_payment` | Aguardando pagamento ou pagamento em processamento |
| `paid` | Pago, aguardando produção/envio |
| `cancelled` | Cancelado pelo cliente ou admin |
| `refunded` | Reembolsado |

Usado em `lib/payment.ts:mapMercadoPagoStatus`.

## Status de pagamento (`Order.paymentStatus`)

| Valor | Significado |
|---|---|
| `pending` | Aguardando |
| `paid` | Aprovado |
| `rejected` | Recusado |
| `cancelled` | Cancelado |
| `refunded` | Reembolsado |

## Status de fulfillment (`Order.fulfillmentStatus`)

| Valor | Significado |
|---|---|
| `pending` | Aguardando produção |
| `in_production` | Em produção |
| `shipped` | Enviado |
| `delivered` | Entregue |

(Hoje só `pending` é setado automaticamente. Fase 4 automatiza com webhook do Melhor Envio.)

## Status de produto (`Product.status`)

| Valor | Significado |
|---|---|
| `draft` | Rascunho — não aparece publicamente |
| `published` | Publicado |
| `archived` | Arquivado |

Filtro público em `lib/catalog.ts:65` exclui `draft`.

## Naming de rotas

- Pasta `app/admin/*` — área administrativa (auth: admin role)
- Pasta `app/api/*` — endpoints
  - `app/api/<recurso>` em PT-BR para rotas chamadas pelo admin (`/api/produtos`, `/api/pedidos`, `/api/banners`, `/api/categorias`)
  - `app/api/<resource>` em EN para rotas chamadas pela loja pública (`/api/products`, `/api/categories`)
  - `app/api/me/*` para endpoints do cliente logado (a criar a partir da Fase 1)
  - `app/api/admin/*` para endpoints exclusivos admin que não cabem em CRUD genérico (Fase 4 — `/api/admin/stats`, `/api/admin/orders/.../refund`)
  - `app/api/auth/*` para autenticação (já existe)
  - `app/api/webhooks/*` para webhooks externos (já existe `mercadopago`; Fase 4 adiciona `melhorenvio`)
- Pastas em PT-BR para páginas voltadas ao usuário final (`/produtos`, `/checkout`, `/meus-pedidos`, `/minha-conta`)
