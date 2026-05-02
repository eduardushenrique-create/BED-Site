# Evolução do schema Prisma

> Estado atual + todas as alterações planejadas por fase. Use como referência única para evitar conflitos entre fases.
>
> **Última atualização:** 2026-05-02 (sessão de fechamento de backlog)

## Estado atual (Fase 5 parcial — LGPD/Wishlist/Auth recovery aplicados)

| Modelo | Campos-chave | Relações |
|---|---|---|
| `Category` | id, name, slug (uniq), isActive, sortOrder | → Product[] |
| `Product` | id, name, slug (uniq), price, status, isActive, isFeatured, stock, underOrder | ← Category, → ProductImage[], ProductVariant[], PersonalizationField[] |
| `ProductImage` | id, productId, variantId?, url, isMain | ← Product, ← ProductVariant? (FK SetNull) |
| `ProductVariant` | id, productId, name, sku, priceDelta, priceOverride?, stockQuantity, isAvailable | ← Product, → ProductImage[] |
| `PersonalizationField` | id, productId, label, fieldType, isRequired | ← Product |
| `Customer` | id, name, email (uniq), phone, isVerified | (sem relações ainda) |
| `AdminUser` | id, name, email (uniq), role, passwordHash | — |
| `Banner` | id, title, subtitle, imageUrl, ctaText, ctaLink, isActive, displayDurationSeconds | — |
| `Order` | id, orderNumber (uniq), customerName, customerEmail, customerPhone, customerCpf, status, paymentStatus, fulfillmentStatus, subtotal, total, shippingMethod, trackingCode | → OrderItem[], Address?, Payment?, Shipment? |
| `OrderItem` | id, orderId, productId, quantity, unitPrice, total | ← Order, ← Product |
| `Address` | id, orderId (uniq), zipCode, street, ..., city, state | ← Order |
| `Payment` | id, orderId (uniq), provider, providerPaymentId, method, status, amount, pixQrCode, pixCopyPaste | ← Order |
| `Shipment` | id, orderId (uniq), provider, serviceName, price, trackingCode | ← Order |
| `Cart` | id, sessionId, userId, couponCode | → CartItem[] (NÃO USADO HOJE) |
| `CartItem` | id, cartId, productId, variantId, quantity, unitPrice | ← Cart, ← Product (NÃO USADO HOJE) |
| `Coupon` | id, code (uniq), type, value, minSubtotal, startsAt, endsAt, usageLimit, usedCount, isActive | (USO PLANEJADO FASE 3) |
| `AuthCode` | id, email, codeHash, ipHash, attempts, expiresAt, usedAt | — |
| `RateLimitBucket` | key (PK), count, resetAt, updatedAt | — (bucket compartilhado para `request-code`, `verify-code`, `password-login`) |
| `WebhookEvent` | id, provider, deliveryKey (uniq), topic, status, payloadHash | — (provider hoje: `mercadopago`, `melhor-envio`) |
| `WishlistItem` | id, customerId, productId, createdAt; UNIQUE (customerId, productId) | ← Customer (cascade) |
| `PasswordResetToken` | id, adminUserId, tokenHash (uniq, sha256), expiresAt, usedAt | ← AdminUser (cascade) |

## Fase 1 — Conta cliente MVP

**Sem mudanças no schema.**

## Fase 2 — Perfil + endereços salvos

### Adicionar
```prisma
model CustomerAddress {
  id           String   @id @default(cuid())
  customerId   String
  customer     Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  label        String?
  recipient    String
  zipCode      String
  street       String
  number       String
  complement   String?
  neighborhood String
  city         String
  state        String
  country      String   @default("BR")
  isDefault    Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([customerId])
}
```

### Alterar Customer
```prisma
model Customer {
  ...
  cpf        String?              // 🆕
  addresses  CustomerAddress[]    // 🆕 inverso
  orders     Order[]              // 🆕 inverso
  ...
}
```

### Alterar Order
```prisma
model Order {
  ...
  customerId String?              // 🆕
  customer   Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)
  ...
}
```

### Migration
- ALTER `Customer` adicionar `cpf`
- ALTER `Order` adicionar `customerId` + FK
- CREATE TABLE `CustomerAddress`
- BACKFILL `Order.customerId` por LOWER(email) match

## Fase 3 — UX e descoberta

### Adicionar
```prisma
model Wishlist {
  id         String   @id @default(cuid())
  customerId String
  customer   Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  productId  String
  product    Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())

  @@unique([customerId, productId])
  @@index([customerId])
}

model PasswordResetToken {
  id        String    @id @default(cuid())
  adminId   String
  admin     AdminUser @relation(fields: [adminId], references: [id], onDelete: Cascade)
  tokenHash String
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([adminId])
}
```

### Alterar Customer
```prisma
model Customer {
  ...
  wishlist Wishlist[]   // 🆕 inverso
  ...
}
```

### Alterar Product
```prisma
model Product {
  ...
  wishlist Wishlist[]   // 🆕 inverso
  ...
}
```

### Alterar AdminUser
```prisma
model AdminUser {
  ...
  passwordResetTokens PasswordResetToken[]   // 🆕 inverso
  ...
}
```

### Alterar Order (cupom usado no pedido)
```prisma
model Order {
  ...
  couponCode    String?              // 🆕 snapshot do código aplicado
  discountValue Decimal? @db.Decimal(10, 2)   // 🆕 valor do desconto aplicado
  ...
}
```

### Alterar Payment (histórico de tentativas Pix)
```prisma
model Payment {
  ...
  attempts Json?         // 🆕 array de tentativas anteriores [{ providerPaymentId, createdAt, expired }]
  ...
}
```

## Fase 4 — Admin operacional

### Sem novos modelos. Possível adicionar:

```prisma
model AuditLog {
  id        String   @id @default(cuid())
  adminId   String?
  admin     AdminUser? @relation(fields: [adminId], references: [id], onDelete: SetNull)
  action    String   // ex: 'order.refund', 'product.delete', 'coupon.create'
  resource  String   // ex: 'order:B&D-XXX', 'product:abc123'
  metadata  Json?
  ipHash    String?
  createdAt DateTime @default(now())

  @@index([action])
  @@index([adminId])
  @@index([createdAt])
}
```

(Decidir se entra na Fase 4 ou Fase 5.)

## Fase 5 — Compliance + observability

### Sem novos modelos obrigatórios.

Opcional (se quisermos persistir consents LGPD):

```prisma
model ConsentLog {
  id         String   @id @default(cuid())
  customerId String?
  customer   Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)
  ipHash     String
  consent    String   // 'full' | 'essential'
  createdAt  DateTime @default(now())

  @@index([customerId])
}
```

## Resumo de migrations a criar

| Fase | Migration | Conteúdo |
|---|---|---|
| 2 | `<ts>_customer_profile_addresses` | CustomerAddress + Customer.cpf + Order.customerId + backfill |
| 3 | `<ts>_wishlist_and_password_reset` | Wishlist + PasswordResetToken + Order.couponCode/discountValue + Payment.attempts |
| 4 (opcional) | `<ts>_audit_log` | AuditLog |
| 5 (opcional) | `<ts>_consent_log` | ConsentLog |

## Checklist por migration

- [ ] Arquivo `migration.sql` SEM BOM (`head -c 3 ... | xxd` mostra `2d2d 20`, não `efbb bf`)
- [ ] Backfills de dados antes de adicionar constraints NOT NULL
- [ ] Índices em FKs filtradas frequentemente
- [ ] Testar em staging antes do merge para `main`
- [ ] Atualizar `lib/localDb.ts` types correspondentes
- [ ] Atualizar `lib/database.ts` serializers
