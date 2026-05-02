# Snapshot da plataforma BED Design — para uso com ChatGPT

> **Como usar este documento:** copie e cole o conteúdo abaixo no início de uma conversa com o ChatGPT. Em seguida, descreva o feature/funcionalidade que você quer adicionar. O assistente terá o contexto completo da arquitetura, schema, rotas, padrões e estado atual — e poderá propor implementação alinhada ao que já existe.
>
> **Última atualização:** 2026-05-02 (sessão pós-backlog: 19 PRs entregues incluindo Wishlist, Refund, Webhook ME, Esqueci-senha, KPIs, LGPD, UX audit, RestockAlert, AuditLog, CI)

---

## 0. Quem é o projeto

**Nome interno:** `forma3d` (slug do package.json) / **Nome de marca:** BED Design / B&D Artes & Impressões.

**Negócio:** e-commerce de produtos de impressão 3D personalizados. Catálogo público + checkout integrado a Mercado Pago + envio via Melhor Envio + área administrativa para gerenciar produtos, categorias, banners, pedidos e clientes.

**Hospedagem:** Railway (Next + Postgres). Build script: `prisma generate && next build`. Start script: `prisma migrate deploy && next start` (migrations rodam no boot do container, não no build).

---

## 1. Stack técnico

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.4 |
| Linguagem | TypeScript | 5.x |
| UI | React | 19.2.4 |
| Estilização | CSS inline (`style={{}}`) + globals.css mínimo | — |
| ORM | Prisma | 7.8.0 |
| Banco | PostgreSQL (Railway) via `@prisma/adapter-pg` | 16 |
| Autenticação | Sessão JWT em cookie httpOnly (custom) | — |
| Pagamento | Mercado Pago (Pix direto + Checkout Pro) | API REST |
| Frete | Melhor Envio | API REST |
| E-mail transacional | Resend | 6.12.2 |
| OAuth | Google | — |
| Testes E2E | Playwright | 1.59.1 |
| Lint | ESLint | 9.x |

**Sem:** Tailwind ativo (instalado mas não usado), Tanstack Query, Zustand, NextAuth, tRPC, Server Actions (usa API Routes tradicionais).

---

## 2. Arquitetura de pastas

```
app/                    Pages e API routes (App Router)
  ├ admin/              Painel administrativo (banners, categorias, clientes, pedidos, produtos)
  ├ api/                Endpoints REST
  │   ├ auth/           Autenticação (request-code, verify-code, password-login, google, logout, me)
  │   ├ banners/        CRUD admin
  │   ├ categorias/     CRUD admin (PT)
  │   ├ categories/     Read-only público (EN)
  │   ├ clientes/       CRUD admin
  │   ├ me/             ✨ Área do cliente logado: /api/me, /api/me/orders, /api/me/addresses
  │   ├ orders/         POST (criar pedido) + GET por orderNumber
  │   ├ pedidos/        CRUD admin
  │   ├ produtos/       CRUD admin (PT)
  │   ├ products/       Read-only público (EN)
  │   ├ shipping/       calculate (Melhor Envio)
  │   └ webhooks/       mercadopago (HMAC verificado)
  ├ checkout/           Página de finalização
  ├ login/              Login + cadastro (abas Entrar/Criar conta)
  ├ minha-conta/        ✨ Dashboard + dados + endereços salvos
  ├ meus-pedidos/       ✨ Lista + [orderNumber] detalhe
  ├ pedido-confirmado/  Pós-checkout
  ├ produtos/           Catálogo público + [slug]
  ├ personalizados/, presentes/, sobre/, contato/, faq/, politica-privacidade/, termos-uso/, trocas-devolucoes/, 403/
  ├ globals.css         Container max-width 1920px + tokens CSS
  ├ layout.tsx          RootLayout com SiteShell
  ├ page.tsx            Home (banner + categorias + produtos em destaque)
  ├ robots.ts, sitemap.ts

components/             Componentes compartilhados (todos client-side hoje)
  ├ Banner.tsx          Carrossel full-bleed com setas, dots, autoplay configurável
  ├ Header.tsx          Sticky com avatar/dropdown quando logado
  ├ CartDrawer.tsx, Footer.tsx, ProductCard.tsx, BrandLogo.tsx
  ├ Button.tsx, Input.tsx, Badge.tsx
  ├ ProductFilter.tsx, ShippingSelector.tsx
  └ SiteShell.tsx       Wrap em AuthProvider + CartProvider, esconde Header/Footer em /admin

context/                React Contexts (client-side)
  ├ AuthContext.tsx     ✨ { user, loading, refresh, logout } — fetch /api/auth/me
  └ CartContext.tsx     Carrinho em memória + localStorage (não persiste em DB)

lib/                    Lógica server-side
  ├ auth.ts             createSession/clearSession/getSessionUser/requireUser/requireAdmin
  ├ auth-shared.ts      SESSION_COOKIE='bed_session', isAdminRole()
  ├ auth-codes.ts       OTP storage (Prisma + fallback fs JSON), rate limit por email+IP
  ├ auth-password.ts    bcrypt para AdminUser
  ├ auth-users.ts       findOrCreateSessionUser (upsert Customer)
  ├ api-auth.ts         requireApiUser, requireApiAdmin (helpers para API routes)
  ├ session-token.ts    JWT encode/decode + getCodePepper
  ├ catalog.ts          Queries públicas (filtra isActive, status≠draft, stock>0 OR underOrder)
  ├ database.ts         CRUD admin + serializers Prisma + helpers /api/me
  ├ localDb.ts          Fallback JSON (data/db.json) quando hasDatabase=false
  ├ prisma.ts           Singleton PrismaClient
  ├ mercadopago.ts      createPaymentPreference, createPixPayment, verifyWebhookSignature
  ├ payment.ts          createPaymentForOrder, mapMercadoPagoStatus, resolvePaymentTransition
  ├ shipping.ts         calculateShipping, SHIPPING_CONFIG
  ├ email.ts            Resend (sendOrderConfirmation, sendAccessCodeEmail)
  ├ validation.ts       validateEmail/CPF/CEP, formatCEP/CPF/Phone
  ├ supabase.ts         legado (não usado em produção)
  └ types.ts            tipos compartilhados

prisma/
  ├ schema.prisma       Modelos: Category, Product, ProductImage, ProductVariant,
  │                     PersonalizationField, Customer, CustomerAddress, AdminUser,
  │                     PasswordResetToken, Banner, Order, OrderItem, Address,
  │                     Payment, Shipment, Cart (não usado), CartItem (não usado),
  │                     Coupon, AuthCode, WebhookEvent, WishlistItem,
  │                     RateLimitBucket, ProductionTask/Log/Settings
  └ migrations/         11 migrations versionadas (até 20260507)

docs/
  └ implementation/     Plano de evolução em 5 fases (este arquivo + outros)
```

---

## 3. Schema Prisma — estado completo atual

```prisma
model Category {
  id             String    @id @default(cuid())
  name           String
  slug           String    @unique
  description    String?
  seoTitle       String?
  seoDescription String?
  sortOrder      Int       @default(0)
  isActive       Boolean   @default(true)
  products       Product[]
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
}

model Product {
  id                    String   @id @default(cuid())
  name                  String
  slug                  String   @unique
  sku                   String?
  shortDescription      String?
  description           String?
  price                 Decimal  @db.Decimal(10, 2)
  compareAtPrice        Decimal? @db.Decimal(10, 2)
  status                String   @default("draft")    // draft | published | archived
  isActive              Boolean  @default(true)
  isFeatured            Boolean  @default(false)
  isPersonalizable      Boolean  @default(false)
  productionTimeMinDays Int      @default(1)
  productionTimeMaxDays Int      @default(3)
  weightGrams           Int?
  widthCm/heightCm/depthCm Decimal? @db.Decimal(10, 2)
  stock                 Int      @default(0)
  underOrder            Boolean  @default(false)
  categoryId            String?
  category              Category? @relation(...)
  images                ProductImage[]
  variants              ProductVariant[]
  personalizationFields PersonalizationField[]
  orderItems            OrderItem[]
  cartItems             CartItem[]
}

model ProductImage   { id, productId, variantId?, url, alt?, sortOrder, isMain }
// ProductVariant: USO FUNCIONAL (CRUD admin + storefront via lib/database.ts)
model ProductVariant { id, productId, name, sku?, color?, size?, material?, finish?, priceDelta?, priceOverride?, stockQuantity, isAvailable, images ProductImage[] }
model PersonalizationField { id, productId, label, fieldType, placeholder?, helpText?, isRequired, minLength?, maxLength?, sortOrder }

model Customer {
  id, name, email (uniq), phone?, cpf?, isVerified
  addresses CustomerAddress[]
  orders    Order[]
}

model CustomerAddress {
  id, customerId, label?, recipient, zipCode, street, number,
  complement?, neighborhood, city, state, country='BR', isDefault, timestamps
  // Limite de 5 por cliente, garantido no helper createAddress()
}

model AdminUser { id, name, email (uniq), role, passwordHash }

model Banner {
  id, title, subtitle?, imageUrl, ctaText?, ctaLink?, isActive,
  displayDurationSeconds=5, timestamps
}

model Order {
  id, orderNumber (uniq), customerName, customerEmail, customerPhone?, customerCpf?
  status            // pending_payment | paid | cancelled | refunded
  paymentStatus     // pending | paid | rejected | cancelled | refunded
  fulfillmentStatus // pending | in_production | shipped | delivered
  subtotal, discountTotal=0, shippingTotal=0, total
  shippingMethod?, trackingCode?, productionDeadline?
  customerId? → Customer (FK SetNull)
  items     OrderItem[]
  address   Address?     // 1:1
  payment   Payment?     // 1:1
  shipment  Shipment?    // 1:1
  @@index([customerEmail]) @@index([customerId])
}

model OrderItem { id, orderId, productId, variantId?, productNameSnapshot, skuSnapshot?, quantity, unitPrice, total, personalizationJson? }

model Address  { id, orderId(uniq), zipCode, street, number, complement?, neighborhood, city, state, country='BR' }

model Payment {
  id, orderId(uniq), provider, providerPaymentId?, method, status,
  amount, pixQrCode?, pixCopyPaste?, paidAt?, rawPayload Json?
}

model Shipment { id, orderId(uniq), provider?, serviceName?, price?, estimatedDays?, trackingCode?, labelUrl?, status? }

// Modelos definidos mas NÃO USADOS pela aplicação:
model Cart     { id, sessionId?, userId?, couponCode?, items CartItem[], timestamps }
model CartItem { id, cartId, productId, variantId?, quantity, unitPrice, personalizationJson? }

// Em uso pelo checkout + admin:
model Coupon   { id, code (uniq), type, value, minSubtotal?, startsAt?, endsAt?, usageLimit?, usedCount=0, isActive }
// usado por POST /api/coupons/validate, POST /api/orders (couponCode opcional) e CRUD admin /api/cupons.
// O código aplicado é snapshot em Payment.rawPayload.couponCode; desconto vai em Order.discountTotal.

// Auth & infra:
model AuthCode     { id, email, codeHash, ipHash, attempts=0, expiresAt, usedAt? }
model WebhookEvent { id, provider, deliveryKey (uniq), topic, resourceId?, eventId?, action?,
                     orderNumber?, paymentId?, payloadHash, signature?, status, receivedAt,
                     processedAt?, lastError?, updatedAt }
```

### Migrations aplicadas (em ordem):
1. `20260430210000_init_railway_postgres` — schema inicial
2. `20260501090000_auth_codes` — AuthCode
3. `20260501113000_webhook_events` — WebhookEvent
4. `20260501200000_banner_display_duration` — Banner.displayDurationSeconds
5. `20260502000000_customer_profile_addresses` — Customer.cpf + CustomerAddress + Order.customerId + backfill por LOWER(email)
6. `20260502120000_production_control` — controle de produção (ProductionTask, ProductionLog, ProductionSettings)
7. `20260503000000_rate_limit_bucket` — RateLimitBucket compartilhado (substitui Map em memória em prod)
8. `20260504000000_storage_keys` — `ProductImage.storageKey` + `Banner.storageKey` (suporte ao Cloudflare R2)
9. `20260505000000_variant_images` — `ProductImage.variantId` (FK SetNull) + `ProductVariant.priceOverride` (Decimal opcional). ProductVariant sai do estado "legado" e passa a USO FUNCIONAL.
10. `20260506000000_wishlist` — `WishlistItem` (BUG-1 resolvido — favoritos persistidos)
11. `20260507000000_password_reset_token` — `PasswordResetToken` (esqueci minha senha do admin)
12. `20260508000000_restock_alerts` — `RestockAlert` (avise quando voltar)
13. `20260509000000_audit_log` — `AuditLog` (auditoria de ações admin sensíveis)
14. `20260510000000_reviews` — `Review` (avaliações de produto com moderação)
15. `20260511000000_printers` — `Printer` + `ProductionTask.printerId` (CRUD impressoras + atribuição de tarefas)

---

## 4. Catálogo completo de endpoints

### Auth público
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/request-code` | Envia OTP por e-mail (rate limit 5/15min) |
| POST | `/api/auth/verify-code` | Valida OTP + cria sessão + upsert Customer |
| POST | `/api/auth/password-login` | Login scrypt para AdminUser |
| POST | `/api/auth/request-password-reset` | Envia link de redefinição (1h TTL, rate-limit 3/15min email + 10/15min IP) |
| POST | `/api/auth/reset-password` | Consome token + atualiza senha (rate-limit 10/15min IP) |
| GET | `/api/auth/google/start` | Inicia OAuth Google |
| GET | `/api/auth/google/callback` | Callback OAuth |
| POST | `/api/auth/logout` | Limpa cookie de sessão |
| GET | `/api/auth/me` | Retorna user da sessão (ou null) |

### Cliente logado (`requireApiUser`)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/me` | Perfil completo (Customer) |
| PATCH | `/api/me` | Atualiza nome/telefone/CPF |
| DELETE | `/api/me` | Anonimiza dados pessoais (LGPD); preserva histórico de pedidos detachado |
| GET | `/api/me/export` | Download JSON com perfil + endereços + pedidos + wishlist (LGPD) |
| GET | `/api/me/orders?status=&limit=&offset=` | Pedidos paginados, filtro por status |
| POST | `/api/me/orders/[orderNumber]/cancel` | Cancela pedido em pending_payment do próprio cliente |
| POST | `/api/me/orders/[orderNumber]/regenerate-pix` | Gera novo Pix para pedido pending (Pix expirado) |
| GET | `/api/me/addresses` | Lista endereços salvos |
| POST | `/api/me/addresses` | Cria (limite 5, transação para isDefault) |
| PUT | `/api/me/addresses/[id]` | Atualiza |
| DELETE | `/api/me/addresses/[id]` | Remove (promove próximo a default se necessário) |
| GET | `/api/me/wishlist` | Lista favoritos com Product join |
| POST | `/api/me/wishlist` body=`{productId}` | Adiciona favorito (idempotente via upsert) |
| DELETE | `/api/me/wishlist/[productId]` | Remove favorito |

### Catálogo público
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/products?category=&featured=&personalizable=&search=` | Lista produtos (filtros) |
| GET | `/api/categories` | Lista categorias com produtos publicados |
| `/api/banners` (GET) | admin only | Banners para admin |

> Banners ativos da home são lidos via SSR direto de `lib/database.ts:listBanners()` em `app/page.tsx`.

### Pedidos
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/api/orders` | customer | Cria pedido + payment + revalida estoque/preço/frete server-side. **502 quando method=card e MP não devolveu checkoutUrl** |
| GET | `/api/orders/[orderNumber]` | dono ou admin | Detalhe (guard de "dono") |
| GET | `/api/pedidos/[id]` | admin | Detalhe por id ou orderNumber para o painel admin |
| POST | `/api/pedidos/[id]/refund` body=`{amount?}` | admin | Estorna no MP (total ou parcial). Atualiza Order para refunded em estorno total |

### Frete
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/shipping/calculate` | Cota Melhor Envio |

### Admin (CRUD genéricos, `requireApiAdmin`)
- `/api/produtos` (GET/POST/PUT/DELETE)
- `/api/produtos/[id]/imagens` (GET/POST/PATCH) + `[imageId]` (PATCH/DELETE) — galeria com upload via storage adapter (R2 ou inline)
- `/api/categorias` (GET/POST/PUT/DELETE)
- `/api/banners` (GET/POST/PUT/DELETE)
- `/api/clientes` (GET/POST/PUT/DELETE)
- `/api/pedidos` (GET/POST/PUT/DELETE)
- `/api/admin/migrate-images` (GET status / POST migra batch base64 → R2; 503 se R2 não configurado)

### Webhooks
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/webhooks/mercadopago` | Atualiza pedido (HMAC + idempotência via WebhookEvent) |
| POST | `/api/webhooks/melhor-envio` | Atualiza fulfillment (HMAC SHA256 + idempotência). Envia email shipped/delivered |
| GET | `/api/clientes/[id]` | Drill-down admin: customer + orders (50) + addresses + totais |
| POST | `/api/products/restock-alerts` | Cliente assina notificação para produto/variação (rate-limited 10/10min/IP, 5/10min/email) |
| GET | `/api/admin/audit-log` | Lista ações sensíveis (admin only). Filtros: actor, action, targetType. Paginação. |
| GET / POST | `/api/me/reviews` | Eligibilidade + envio de avaliação pelo cliente |
| GET | `/api/products/[id]/reviews` | Lista pública de reviews aprovadas + agregado |
| GET / PATCH / DELETE | `/api/avaliacoes` (e `[id]`) | Moderação admin |
| GET / POST | `/api/impressoras` | CRUD de impressoras (admin) |
| GET / PATCH / DELETE | `/api/impressoras/[id]` | Detalhe / atualizar / excluir (admin) |
| POST | `/api/producao/[id]/assign` | Atribui tarefa de produção a uma impressora |

---

## 5. Sessão e roles

**Cookie:** `bed_session` (httpOnly, sameSite=lax, secure em prod, TTL 7 dias)

**Roles** (em `lib/auth.ts:10`):
- `customer` — cliente final
- `support`, `orders_manager`, `catalog_manager`, `admin`, `owner`, `global_admin` — todos considerados "admin" por `isAdminRole()`

**Como alguém vira admin:** o e-mail está em `OWNER_EMAILS` ou `ADMIN_EMAILS` (env vars), checado em `lib/auth-users.ts:roleForEmail()`. Não há UI para promover.

**Helpers:**
- `requireUser(redirectTo)` — redireciona para login se não logado
- `requireAdmin()` — redireciona para `/403` se não admin
- `requireApiUser()` — retorna 401 JSON
- `requireApiAdmin()` — retorna 403 JSON

---

## 6. Variáveis de ambiente

```env
# Database
DATABASE_URL=postgresql://...

# Mercado Pago
PAYMENT_PROVIDER=mercadopago
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
MERCADOPAGO_WEBHOOK_SECRET=...
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=APP_USR-...   # declarado mas não consumido pelo código

# Melhor Envio
MELHOR_ENVIO_TOKEN=...
MELHOR_ENVIO_SECRET=...

# Email
RESEND_API_KEY=re_...

# App
NEXT_PUBLIC_APP_URL=https://seu-dominio.com.br
NEXT_PUBLIC_STORE_ORIGIN_ZIP=01001000

# Admin gating
OWNER_EMAILS=email1@x,email2@y
ADMIN_EMAILS=email3@z

# Supabase (legado, opcional, não consumido)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Cloudflare R2 (object storage para imagens — opcional, fallback inline base64)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=  # ex: https://pub-xxxxx.r2.dev OU custom domain
```

---

## 7. Padrões de código

### Estrutura de função CRUD em `lib/database.ts`

Toda função admin segue:
```ts
export async function listFoo() {
  if (!hasDatabase || !prisma?.foo) {
    return readDB().foos       // fallback localDb
  }
  try {
    const result = await prisma.foo.findMany({ ... })
    return result.map(serializeFoo)
  } catch (error) {
    console.error('[database] listFoo Prisma failed, using fallback:', error)
    return readDB().foos
  }
}
```

`lib/catalog.ts` (queries públicas) **NÃO tem fallback** — retorna `[]` em falha. Razão: evitar expor dados do `localDb` em prod.

### API routes
```ts
import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireApiUser()  // ou requireApiAdmin
  if (auth.response) return auth.response

  // ... lógica
  return NextResponse.json(data)
}
```

### Convenção de naming de rotas
- `/api/<recurso>` em **PT-BR** para rotas chamadas pelo admin (`/api/produtos`, `/api/pedidos`, `/api/banners`, `/api/categorias`)
- `/api/<resource>` em **EN** para rotas públicas (`/api/products`, `/api/categories`)
- `/api/me/*` para endpoints do cliente logado
- `/api/webhooks/*` para webhooks externos
- Pastas em **PT-BR** para páginas voltadas ao usuário final (`/produtos`, `/checkout`, `/meus-pedidos`, `/minha-conta`)

### Migrations
- **NUNCA** salvar `migration.sql` com BOM UTF-8 (Postgres rejeita com `syntax error at or near "﻿"`). Verificar com `head -c 3 ... | xxd` — deve mostrar `2d2d 20`, não `efbb bf`.
- Migrations rodam no **start** (não no build) porque o build do Railway pode não ter rede para o Postgres privado.

### Componentes
- Todos os componentes em `components/` são `'use client'` por padrão
- Páginas em `app/` são Server Components por padrão; viram client quando precisam de hooks
- Estilização inline (`style={{}}`). Sem classes Tailwind/CSS Modules

### Carrinho
- `context/CartContext.tsx` mantém em React state + localStorage
- Modelos `Cart`/`CartItem` no Prisma existem mas **não são usados**
- Carrinho NÃO persiste entre dispositivos

---

## 8. Fluxos críticos

### Fluxo de checkout (cliente novo)
1. Usuário adiciona produtos ao carrinho (Context React)
2. Click em "Finalizar" → `/checkout` → exige login (`POST /api/orders` é `requireApiUser`)
3. Se cliente novo, vai para `/login?redirect=/checkout`
4. Após login, `/checkout` pré-popula nome/telefone/CPF de `/api/me` e endereço default de `/api/me/addresses`
5. Frete é calculado em `/api/shipping/calculate` quando o CEP completa 8 dígitos
6. Submit faz POST `/api/orders`:
   - Revalida produtos no banco (preço, estoque, sob encomenda)
   - Calcula frete server-side (não confia no client)
   - Cria `Order` + `OrderItem` + `Address` + `Payment`
   - Chama `createPaymentForOrder` que decide entre Pix direto ou preferência Checkout Pro
7. Resposta inclui `payment.checkoutUrl` (cartão) ou QR Pix
8. Frontend redireciona para `/pedido-confirmado?pedido=NNN`

### Fluxo de webhook MP
1. MP chama `POST /api/webhooks/mercadopago` com header `x-signature` (HMAC)
2. `verifyWebhookSignature` valida HMAC com `MERCADOPAGO_WEBHOOK_SECRET`
3. `WebhookEvent` é registrado para idempotência (`deliveryKey` único)
4. Se topic = `payment`, busca detalhe completo via `getPaymentDetails`
5. `mapMercadoPagoStatus` converte para `{ orderStatus, paymentStatus }`
6. `resolvePaymentTransition` evita regressão (paid → pending nunca persiste)
7. `updateOrderPaymentByNumber` atualiza Order + Payment
8. `updateWebhookEvent` marca o evento como processado/falho

### Fluxo de OTP por e-mail
1. Cliente digita e-mail (e nome se aba "Criar conta") em `/login`
2. POST `/api/auth/request-code` → gera código de 6 dígitos, hasheia e armazena com TTL 10min
3. Resend envia e-mail com o código (`sendAccessCodeEmail`)
4. Cliente digita código → POST `/api/auth/verify-code` → `consumeAccessCode` valida e marca usado
5. `findOrCreateSessionUser` faz upsert no Customer (se admin email, usa AdminUser e role)
6. `createSession` seta cookie JWT
7. Frontend faz `router.push(redirectTo)` (default `/minha-conta`)

---

## 9. O que está IMPLEMENTADO

### Storefront (público + cliente)
- ✅ Home com banner carousel full-bleed (autoplay configurável por banner, setas, dots)
- ✅ Catálogo `/produtos` com filtros por categoria
- ✅ Detalhe `/produtos/[slug]` com personalização
- ✅ Carrinho (Context + localStorage, drawer lateral)
- ✅ Checkout completo com cálculo de frete e pagamento (paymentMethod default vazio → escolha obrigatória)
- ✅ Páginas estáticas: sobre, contato, faq, presentes, personalizados, políticas
- ✅ Login + cadastro em abas
- ✅ Login por OTP, senha, Google
- ✅ **Esqueci minha senha** (`/login/esqueci-senha`, `/login/redefinir-senha?token=...`)
- ✅ Header com avatar/dropdown quando logado
- ✅ `/minha-conta` (dashboard) + `/dados` + `/enderecos` + `/favoritos` + `/privacidade`
- ✅ `/meus-pedidos` (lista com filtro) + detalhe com timeline
- ✅ **Cancelamento self-service** de pedido pending payment
- ✅ **Regenerar Pix** expirado direto na tela do pedido
- ✅ **Wishlist** (coração no ProductCard funcional, página de favoritos)
- ✅ **Banner de cookies** (LGPD)
- ✅ **Exportar dados** + **Excluir conta** (anonimização)
- ✅ **Avise quando voltar** em produtos esgotados
- ✅ **Avaliações de produto** (cliente pode avaliar produtos comprados; rating exibido no ProductCard)
- ✅ **Header mobile responsivo** (auditoria UX 02/05/2026)
- ✅ Logout funcional

### Admin
- ✅ `/admin` com **KPIs em tempo real** (vendas hoje/mês, ticket médio, em produção, top produto)
- ✅ `/admin/produtos` CRUD com upload de imagem
- ✅ `/admin/categorias` CRUD
- ✅ `/admin/banners` CRUD com tempo de exibição
- ✅ `/admin/clientes` lista + busca + **drill-down `/admin/clientes/[id]`** (totais + pedidos + endereços)
- ✅ `/admin/pedidos` lista com **filtros avançados** (status, pagamento, intervalo de datas, total mínimo) + **export CSV**
- ✅ `/admin/pedidos/[id]` detalhe com **botão Estorno** (refund MP) e cupom/desconto
- ✅ `/admin/cupons` CRUD com ativação, validade e limite de uso
- ✅ `/admin/auditoria` — log de ações sensíveis (estornos, alterações, exclusões) com filtros e paginação
- ✅ `/admin/avaliacoes` — moderação das reviews de produto (aprovar/ocultar/excluir)
- ✅ `/admin/impressoras` — CRUD de impressoras (capacidade, status, materiais)
- ✅ `/admin/producao` — coluna de impressora com select inline para atribuir tarefas
- ✅ Login scrypt restrito por env var (com fluxo de redefinição via email)
- ✅ Guard de role em todas as APIs admin

### Backend / infra
- ✅ Sessão JWT em cookie httpOnly (TTL 7 dias)
- ✅ Webhook MP com HMAC + idempotência via WebhookEvent
- ✅ **Webhook Melhor Envio** com HMAC-SHA256 + idempotência + atualização automática do fulfillment + emails
- ✅ Rate limit em `/api/auth/request-code` (5/15min por email+IP), `/api/auth/verify-code` (5/10min por email + 30/10min por IP), `/api/auth/password-login` (5/10min por email + 20/10min por IP), `/api/auth/request-password-reset` (3/15min email + 10/15min IP), `/api/auth/reset-password` (10/15min IP) — bucket compartilhado em `lib/rate-limit.ts`
- ✅ **Notificações por e-mail centralizadas** em `lib/order-notifications.ts:notifyOrderStatusChange` — disparam ao admin alterar status (paid → in_production → shipped → delivered → cancelled/refunded). Webhook ME envia próprios emails para evitar dupla via PUT
- ✅ **Refund Mercado Pago** — `POST /v1/payments/{id}/refunds` via `refundMercadoPagoPayment` com X-Idempotency-Key
- ✅ Validação de CPF/CEP/telefone/email server-side
- ✅ Fallback `localDb` para dev sem Postgres
- ✅ Migrations versionadas
- ✅ Container max-width 1920px (estilo KaBuM)

---

## 10. O que NÃO está implementado (próximas fases planejadas)

### Fase 3 — UX e descoberta
- ✅ Busca de produtos no header
- ✅ **Wishlist/favoritos** (PR #20)
- ✅ Cupons no checkout (validação server-side, UI no `/checkout`, snapshot do código gravado em `Payment.rawPayload.couponCode`)
- ✅ **Esqueci minha senha** do admin (PR #21)
- ✅ **Refazer Pix expirado** (PR #28)

### Fase 4 — Admin operacional
- ✅ **Dashboard com KPIs** (PR #24)
- ✅ CRUD admin de cupons (`/admin/cupons` + `/api/cupons`)
- ✅ **Drill-down de cliente** → seus pedidos (PR #25)
- ✅ **Webhook do Melhor Envio** para tracking automático (PR #22)
- ✅ **Filtros avançados em pedidos** + export CSV (PR #29)
- ✅ **Refund flow integrado ao MP** (PR #23)

### Fase 5 — Compliance + observability
- ✅ **Banner de cookies LGPD** (PR #30)
- ✅ **"Excluir minha conta"** (anonimização, PR #30)
- ✅ **"Exportar meus dados"** (LGPD, PR #30)
- ✅ Sentry / observability (DSN-opcional — sem DSN o app funciona normal; com DSN setado começa a reportar automaticamente). Helpers `captureException`/`captureMessage` em `lib/observability.ts`. Adotado em webhook MP, webhook ME, `lib/mercadopago.ts`, `lib/payment.ts`, `app/api/orders` e `app/api/producao/[id]`. PII scrub best-effort em `lib/sentry-scrub.ts`.
- ✅ Object storage (Cloudflare R2 — DSN-opcional)
- ❌ Rate limit nos demais endpoints sensíveis (Upstash Redis)
- ❌ Captcha (Turnstile)
- ❌ Logs estruturados (pino)
- ✅ **CI/CD com lint/typecheck/build** (PR #36, `.github/workflows/ci.yml` + `tsconfig.ci.json`)
- ❌ Carrinho persistente em DB (modelo `Cart` existe, sem uso)
- ✅ **Reviews/avaliações** de produtos (PR #39)
- ✅ **Auditoria admin** (`AuditLog`, PR #35)
- ✅ **"Avise quando voltar"** para produtos sem estoque (PR #34)
- ✅ **CRUD de impressoras** + atribuição de tarefas (PR #40)
- ❌ Migração `<SafeImage>` → `next/image` (depende de R2 ativo)

### Bugs conhecidos / dívidas
- `tests/e2e.spec.ts` tem erros de tipo, não roda no CI
- `app/api/orders/[orderNumber]/route.ts:8` usa `RouteContext` não tipado (erro de tipo conhecido)
- Modelos `Cart`/`CartItem` no schema sem uso na aplicação (apenas `Coupon` está em uso)
- `lib/supabase.ts` é legado, não é usado em produção
- Páginas estáticas (sobre, faq, políticas) ficam com linhas muito largas em monitor 1920px (sem `max-width` de leitura interno)
- E-mail não pode ser trocado pelo cliente (precisa fazer via suporte)

---

## 11. Decisões arquiteturais já tomadas (não reabrir sem motivo forte)

1. **Container global em 1920px** (estilo KaBuM) — cliente pediu explícito
2. **OTP cria conta automaticamente** (sem tela separada de cadastro além das abas), mas a aba "Criar conta" coleta nome+telefone para enriquecer o customer
3. **Order.customerEmail é a fonte de verdade**, com `customerId` opcional como FK secundária (preserva pedidos antigos)
4. **Carrinho fica no client** — não persiste em DB hoje
5. **Migrations rodam no start, não no build** (build no Railway pode não ter rede para o DB)
6. **PT-BR para rotas admin (`/api/produtos`)**, **EN para rotas públicas (`/api/products`)** — convenção a manter
7. **Estilização inline** sem Tailwind ativo — manter consistência até decidir migrar
8. **Roles admin via env vars (`OWNER_EMAILS`, `ADMIN_EMAILS`)** — sem UI para promover
9. **Limite de 5 endereços por cliente** — configurável no código
10. **Sem CI/CD com gate** — Railway só builda no push para `main`

---

## 12. Como gerar nova feature seguindo o padrão

Roteiro recomendado para o ChatGPT propor uma feature nova:

1. **Definir escopo:** o que entra e o que NÃO entra
2. **Schema:** que modelos novos ou alterações? Migration SQL com:
   - Sem BOM
   - Backfill de dados se mudou tipo/constraint
   - Índices em FKs filtradas
3. **Atualizar `lib/localDb.ts`:** types correspondentes para o fallback
4. **Atualizar `lib/database.ts`:** serializers + funções CRUD seguindo o pattern (Prisma + fallback localDb + try/catch)
5. **Endpoints:** rota REST sob `/api/me/*` (cliente) ou `/api/admin/*` ou `/api/<recurso>` (CRUD admin)
   - Usar `requireApiUser` ou `requireApiAdmin`
   - `dynamic = 'force-dynamic'` se lê DB
   - Validar input antes de tocar no DB
6. **Telas:** Server ou Client Component conforme necessidade
   - Páginas client-side autenticadas: usar `useAuth()` para verificar e redirecionar
   - Páginas server-side autenticadas: usar `requireUser` no topo
7. **Critérios de aceite + plano de teste:** lista de checks manuais (mínimo) + sugestão de teste E2E
8. **Rodar antes de PR:**
   - `npx prisma generate`
   - `npx tsc --noEmit`
   - `npx next build`

### Template de PR
```markdown
## Summary
<o que entrega>

## Why
<motivação>

## Schema
- <mudanças no schema, se houver>

## Endpoints
- <lista>

## Screens
- <lista>

## Test plan
- [ ] ...
```

---

## 13. Nomeação consistente

| Conceito | Nome técnico |
|---|---|
| Cliente final | `Customer` (Prisma) / `SessionUser` (sessão) / "user" (UI) |
| Operador da loja | `AdminUser` (Prisma) com role específico |
| Pedido | `Order` |
| Endereço de entrega de UM pedido | `Address` (1:1 com Order) |
| Endereço salvo do cliente | `CustomerAddress` |
| Pagamento de UM pedido | `Payment` (1:1 com Order) |
| Envio de UM pedido | `Shipment` (1:1 com Order) |
| Banner do hero | `Banner` |
| Variação de produto | `ProductVariant` |
| Campo de personalização | `PersonalizationField` |
| Cupom | `Coupon` |
| OTP por e-mail | `AuthCode` |
| Evento de webhook | `WebhookEvent` |

### Status de Order.status
- `pending_payment` — aguardando pagamento
- `paid` — pago, aguardando produção/envio
- `cancelled`, `refunded`

### Status de Order.fulfillmentStatus
- `pending` — aguardando produção
- `in_production` — em produção
- `shipped` — enviado
- `delivered` — entregue

### Status de Product.status
- `draft` — rascunho (não público)
- `published` — publicado
- `archived` — arquivado

---

## 14. Glossário rápido para o ChatGPT

- **MP:** Mercado Pago
- **ME:** Melhor Envio
- **OTP:** One-Time Password (código por e-mail)
- **HMAC:** assinatura criptográfica que valida origem do webhook
- **Idempotência:** garantir que processar o mesmo evento 2x não muda o estado
- **Backfill:** migração de dados existentes para uma nova estrutura
- **`hasDatabase`:** flag `lib/database.ts:7` que decide entre Prisma ou fallback JSON
- **`requireApiUser/Admin`:** helpers de guard em API routes (`lib/api-auth.ts`)
- **Worktree:** estamos trabalhando em um git worktree em `.claude/worktrees/...`, branch `claude/modest-wilson-570c64`, mas os PRs vão para `main`

---

## 15. Comandos úteis

```bash
npm install                    # Instalar deps
npm run dev                    # Dev server
npm run build                  # Build de produção (prisma generate + next build)
npm start                      # Start prod (prisma migrate deploy + next start)
npm run lint                   # ESLint

npx prisma generate            # Regenerar cliente após editar schema
npx prisma migrate dev --name <nome>   # Criar e aplicar migration em dev
npx prisma migrate deploy      # Aplicar migrations pendentes em prod
npx prisma studio              # GUI do banco
npx prisma format              # Formatar schema.prisma
npx prisma validate            # Validar schema

npx tsc --noEmit               # Type check sem build
npx next build                 # Build completo
npx playwright test            # E2E (atualmente quebrado)
```

---

## 16. Como pedir ao ChatGPT

> **Modelo de prompt:**
>
> "Tenho o snapshot acima do meu site BED Design (Next 16 + Prisma + Postgres no Railway). Preciso implementar **<feature>**. Por favor, me responda com:
> 1. Escopo (o que entra/não entra)
> 2. Mudanças no schema (com SQL da migration sem BOM)
> 3. Endpoints novos (request/response)
> 4. Telas (que páginas criar/modificar e como ficam)
> 5. Arquivos a criar/modificar (caminho exato)
> 6. Critérios de aceite (checklist)
> 7. Decisões pendentes que precisam do meu input
> 8. Riscos e mitigações
>
> Siga as convenções do snapshot: rotas admin em PT, públicas em EN, `/api/me` para cliente, `requireApiUser/Admin`, fallback localDb em `lib/database.ts`, etc."

---

**Fim do snapshot.** Cole tudo acima na conversa do ChatGPT antes de perguntar.
