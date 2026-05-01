# Fase 03 — UX e descoberta

> Objetivo: aumentar conversão e taxa de retorno (busca, wishlist, cupons, recuperação de senha).

## Escopo

1. **Busca de produtos** (header + página de resultados)
2. **Wishlist/favoritos** (autenticado)
3. **Cupons no checkout** (validação + aplicação)
4. **Esqueci minha senha** (admin)
5. **Refazer Pix expirado**

---

## 1. Busca de produtos

### Backend
**Endpoint existente já cobre:** `GET /api/products?search=foo` — usa `getLocalCatalogProducts({ search })` em `lib/catalog.ts:72`.

Limitação atual: case-insensitive `contains` em `name`, `description`, `shortDescription`, `sku`, `category.name`. Não tem ranking nem normalização (acentos, plural). Para v1 está OK; v2 considerar pg_trgm ou Meilisearch.

### Frontend

**Header:** o botão de busca hoje não faz nada (`components/Header.tsx:99`). Implementar:

- Click no ícone abre overlay de busca (estilo KaBuM/Mercado Livre)
- Input com debounce 300ms
- Dropdown mostra até 6 sugestões enquanto digita (call em `/api/products?search=...`)
- Enter ou click em "Ver todos os resultados" navega para `/produtos?busca=foo`

**Página `/produtos`:** já lê `searchParams.get('categoria')`. Estender para ler `busca` também e passar como query da API.

### Arquivos
| Tipo | Caminho |
|---|---|
| 🆕 | `components/SearchOverlay.tsx` |
| ✏️ | `components/Header.tsx` |
| ✏️ | `app/produtos/page.tsx` |

---

## 2. Wishlist / favoritos

### Schema novo
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
```

E adicionar `wishlist Wishlist[]` em `Customer` e `Product`.

### Endpoints
- `GET /api/me/wishlist` — lista produtos favoritados do usuário
- `POST /api/me/wishlist` body `{ productId }` — adiciona
- `DELETE /api/me/wishlist/[productId]` — remove

### Frontend
- `ProductCard` ganha botão de coração no canto superior direito
- Não logado → click leva para `/login?redirect=...&next=wishlist:add:<productId>` (que após login adiciona automaticamente)
- Página `/minha-conta/favoritos` lista produtos salvos com botão "Adicionar ao carrinho"

---

## 3. Cupons no checkout

### Status do schema
Modelo `Coupon` já existe ([prisma/schema.prisma:233](../../../prisma/schema.prisma:233)). Falta uso.

### Endpoints
- `POST /api/coupons/validate` body `{ code, subtotal }` → retorna desconto calculado ou erro
  - Verifica: `isActive`, `startsAt <= now <= endsAt`, `usedCount < usageLimit`, `subtotal >= minSubtotal`
  - Retorno: `{ valid: true, discount: 10.00, type: 'fixed' | 'percentage', value: 10 }`

### Frontend
- No `/checkout`, abaixo do total: input "Cupom de desconto" + botão "Aplicar"
- Após aplicar: linha "Desconto: -R$ X,XX" no resumo + total recalculado
- Botão "Remover" se cupom já aplicado

### Backend de pedido
- `app/api/orders/route.ts` precisa receber `couponCode` opcional e aplicar mesma validação
- Após pedido criado com sucesso, `Coupon.usedCount += 1` (transação)

### Admin
- Nova página `/admin/cupons` (CRUD) — Fase 4

---

## 4. Esqueci minha senha (admin)

> OTP por e-mail já cobre clientes. Admins usam senha bcrypt (`AdminUser`) e não têm reset hoje.

### Schema novo
```prisma
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

### Endpoints
- `POST /api/auth/forgot-password` body `{ email }` → sempre retorna 200 (anti enumeration). Se admin existe, envia e-mail com link `/reset-password?token=...`
- `POST /api/auth/reset-password` body `{ token, newPassword }` → valida token (não usado, não expirado), atualiza `passwordHash`, marca `usedAt`

### Telas
- `/esqueci-senha`: form com e-mail, mensagem "se houver conta, enviamos um link"
- `/reset-password?token=xxx`: form com nova senha + confirmação. Se token inválido, mensagem genérica

### Configuração
- TTL do token: 30 minutos
- E-mail HTML básico via Resend ([lib/email.ts](../../lib/email.ts)) — adicionar `sendPasswordResetEmail`

---

## 5. Refazer Pix expirado

Pix do MP expira em 30 min por padrão. Hoje cliente fica preso com QR inválido.

### Endpoint
- `POST /api/orders/[orderNumber]/regenerate-pix` (auth: dono do pedido)
  - Verifica que `paymentMethod === 'pix'`, `paymentStatus !== 'paid'`
  - Chama `createPixPayment` novamente
  - Atualiza `Payment` com novo `pixCopyPaste`/`pixQrCode`/`providerPaymentId`
  - Mantém `Order` (mesmo `orderNumber`)

### Frontend
- Em `/meus-pedidos/[orderNumber]` e `/pedido-confirmado`: se Pix pendente há mais de 30 min, mostrar botão "Gerar novo Pix"
- Após gerar, atualizar QR sem refresh

---

## Arquivos a criar/modificar (resumo)

| Tipo | Caminho |
|---|---|
| 🆕 | `components/SearchOverlay.tsx` |
| 🆕 | `app/api/me/wishlist/route.ts` |
| 🆕 | `app/api/me/wishlist/[productId]/route.ts` |
| 🆕 | `app/api/coupons/validate/route.ts` |
| 🆕 | `app/api/auth/forgot-password/route.ts` |
| 🆕 | `app/api/auth/reset-password/route.ts` |
| 🆕 | `app/api/orders/[orderNumber]/regenerate-pix/route.ts` |
| 🆕 | `app/esqueci-senha/page.tsx` |
| 🆕 | `app/reset-password/page.tsx` |
| 🆕 | `app/minha-conta/favoritos/page.tsx` |
| ✏️ | `prisma/schema.prisma` (Wishlist, PasswordResetToken) |
| 🆕 | `prisma/migrations/<ts>_wishlist_and_password_reset/migration.sql` |
| ✏️ | `app/checkout/page.tsx` (cupom) |
| ✏️ | `app/api/orders/route.ts` (couponCode) |
| ✏️ | `components/ProductCard.tsx` (botão coração) |
| ✏️ | `components/Header.tsx` (busca) |
| ✏️ | `lib/email.ts` (sendPasswordResetEmail) |

## Critérios de aceite

### Busca
- [ ] Click no ícone do header abre overlay
- [ ] Sugestões aparecem a partir de 2+ caracteres
- [ ] Enter navega para `/produtos?busca=foo`
- [ ] Resultados respeitam categorias publicadas

### Wishlist
- [ ] Coração vazio quando produto não favoritado, cheio quando sim
- [ ] Click sem login redireciona para `/login` e completa ação após
- [ ] `/minha-conta/favoritos` lista corretamente

### Cupons
- [ ] Cupom inválido mostra erro claro
- [ ] Cupom expirado/usado/abaixo do mínimo retorna mensagem específica
- [ ] Total recalcula corretamente
- [ ] `usedCount` incrementa após pedido criado (verificar via `select` no admin/DB)
- [ ] Cupom percentual e fixo funcionam

### Esqueci senha
- [ ] Endpoint sempre retorna 200 (mesmo se e-mail não existir)
- [ ] E-mail chega via Resend
- [ ] Token expira após 30min
- [ ] Token usado não funciona de novo
- [ ] Senha nova é bcrypted e funciona no login

### Refazer Pix
- [ ] Botão aparece só se Pix pendente
- [ ] Novo QR vem com novo `providerPaymentId`
- [ ] Histórico do Pix antigo preservado em algum log (decidir: campo `paymentAttempts: Json` ou tabela nova)

## Decisões pendentes

1. **Histórico de tentativas Pix:** novo campo JSON em `Payment` ou tabela `PaymentAttempt`? Recomendação: campo JSON (simples).
2. **Wishlist sem login (anônima):** alguns sites permitem via cookie. Recomendação: requer login (simplifica).
3. **Limite de cupons aplicáveis simultaneamente:** 1 por pedido. OK?

## Riscos

- **Wishlist explode com bots:** rate-limit (Fase 5)
- **Cupom race condition** (último uso aplicado por 2 clientes simultâneos): aplicar `usedCount < usageLimit` em transação com `SELECT ... FOR UPDATE`
- **Reset de senha por bruteforce de token:** hash do token + verificação `timingSafeEqual` (já temos util em `lib/mercadopago.ts:196`)
