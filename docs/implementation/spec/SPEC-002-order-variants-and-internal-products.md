# SPEC-002 — Seleção de variação no pedido + Produtos internos (admin-only)

> **Status:** Draft — aguardando aprovação do stakeholder
> **Data:** 2026-05-05
> **Branch:** `claude/romantic-benz-04f94e`
> **Relacionado:** `Product`, `ProductVariant`, `OrderItem`, módulo de Pedidos (admin e site)

---

## 1. Contexto e problemas reportados

O stakeholder reportou dois problemas conectados ao fluxo de pedidos:

1. **"Não está sendo possível escolher a variação no momento de criar um pedido, tanto no site quanto na área administrativa."**
2. **"Criar uma feature que permita produtos que apareçam apenas na área administrativa e possam ser usados em pedidos apenas por administradores."**

Ambos tocam o mesmo ponto: o caminho que vai do cadastro de produto → carrinho/admin → `OrderItem`. O primeiro é um **bug de paridade** entre o que o domínio suporta (`OrderItem.variantId` já existe) e o que a UI/API expõe. O segundo é uma **feature nova** que precisa de campo no schema.

Trato as duas frentes em uma SPEC só porque elas compartilham:
- O mesmo formulário de "novo pedido" no admin.
- O mesmo endpoint `/api/produtos` que alimenta esse formulário.
- A mesma validação server-side em `/api/orders` e `/api/pedidos`.

---

## 2. Diagnóstico técnico

### 2.1 Onde a seleção de variação **funciona hoje**

- **`app/produtos/[slug]/ProductDetailClient.tsx`**: tem botões de variação, calcula preço efetivo (`priceOverride ?? base + priceDelta`), bloqueia "Adicionar ao carrinho" sem variação selecionada quando o produto tem variantes (linhas 91‑96).
- **`app/api/orders/route.ts`** (checkout público): valida `variantId` server-side, recusa pedido sem variação quando o produto tem variantes (linhas 128‑156).
- **`lib/database.ts → createOrder`**: já persiste `variantId` em `OrderItem` (linha 1606).
- **`context/CartContext.tsx`**: `addItem` já desambigua linhas pelo par `productId + variantId` (linha 56).

### 2.2 Onde a seleção de variação **NÃO funciona**

| Local | Arquivo | Problema |
|---|---|---|
| Modal "Novo Pedido" no admin | [`app/admin/pedidos/page.tsx:310`](app/admin/pedidos/page.tsx) | `handleAddProduct` cria item só com `productId, productName, quantity, unitPrice`. Nenhum campo `variantId`. UI nem mostra variantes. |
| Modal "Editar Itens do Pedido" no admin | [`app/admin/pedidos/[id]/page.tsx:343`](app/admin/pedidos/%5Bid%5D/page.tsx) | Mesmo problema. Admin altera itens sem nunca ver/escolher variação. |
| API admin de produtos | [`app/api/produtos/route.ts`](app/api/produtos/route.ts) → [`lib/database.ts:252 listProducts`](lib/database.ts) | Inclui `category` e `images`, **mas não inclui `variants`**. O admin não tem como saber que existem variantes mesmo se quisesse mostrá-las. |
| API admin de pedidos | [`app/api/pedidos/route.ts`](app/api/pedidos/route.ts) `POST/PUT` | Não valida `variantId` (apenas confia no que o cliente manda). Quando o admin manda só `productId`, o pedido salva sem variação — silenciosamente. |
| `CartDrawer` no site | [`components/CartDrawer.tsx`](components/CartDrawer.tsx) | Mostra nome da variação mas não permite **trocar** variação. Cliente que escolheu "errado" precisa remover e voltar à página do produto. UX ruim, mas não é bug crítico. |

### 2.3 Onde a feature de "produto interno" precisa entrar

Hoje o filtro público é (`lib/catalog.ts:85` `getPublicProductWhere`):
```ts
isActive: true,
status: { not: 'draft' },
// + filtros de categoria/featured/personalizable
```

Não há campo que diga "este produto existe apenas para uso interno do admin (ex.: produto de revenda, brinde, peça customizada não-listada, kit B2B, ajuste manual)". As únicas alavancas atuais são:

- `isActive=false` → some do site **e** do admin (não pode ser usado em pedidos).
- `status='draft'` → some do site **e** indica WIP no admin (UX confusa para "produto pronto, só não-público").
- `status='archived'` → some de tudo, é um estado terminal.

Nenhuma serve. Precisa de campo novo.

---

## 3. Proposta — Parte A: Seleção de variação no pedido

### 3.1 Mudanças no `lib/database.ts → listProducts`

Incluir variantes ativas. Mantém compatibilidade com fallback JSON (que já carrega variantes implicitamente via `readDB().products`).

```ts
const products = await prisma.product.findMany({
  include: {
    category: true,
    images: { orderBy: { sortOrder: 'asc' } },
    variants: {
      where: { isAvailable: true },
      orderBy: { name: 'asc' },
    },
  },
  orderBy: [{ isFeatured: 'desc' }, { name: 'asc' }],
})
```

E o `serializeProduct` precisa expor `variants` no payload do admin (já existe shape em `lib/types.ts → ProductVariant`).

### 3.2 UI — Modal "Novo Pedido" (`app/admin/pedidos/page.tsx`)

**Estado novo:**
```ts
type NewOrderItem = {
  productId: string
  productName: string
  variantId: string | null
  variantName: string | null
  quantity: number
  unitPrice: number
  observation?: string
}
```

**Fluxo:**
1. Admin clica num card de produto no grid de filtragem.
2. Se `product.variants.length === 0` → adiciona ao pedido como hoje.
3. Se `product.variants.length > 0` → abre **sub-popover** ancorado no card listando todas as variantes ativas. Cada linha mostra:
   - Nome composto (color/size/material/finish ou `variant.name`).
   - SKU (se houver).
   - Estoque (`stockQuantity`) ou "Sob encomenda" se `product.underOrder`.
   - Preço efetivo (`priceOverride ?? product.price + priceDelta`).
   - Botão "Adicionar".
4. Ao adicionar, o item entra com `variantId`, `variantName`, `unitPrice` calculado pela variação.
5. Mesma variação clicada de novo → incrementa quantidade da linha já existente.
6. Variação diferente do mesmo produto → **outra linha** no pedido (paridade com o site).

**Listagem de itens do pedido:** mostrar "Nome do produto · Variação" (ex.: `Luminária Cubo · 12cm — Branco fosco`).

**Helper compartilhado:** extrair de `ProductDetailClient` para `lib/products/variant-pricing.ts`:
```ts
export function variantEffectivePrice(basePrice: number, variant: ProductVariant | null): number
export function describeVariant(variant: ProductVariant): string
```
e reusar no admin e no site (DRY, e sobretudo evita divergência futura).

### 3.3 UI — Modal "Editar Itens" (`app/admin/pedidos/[id]/page.tsx`)

Mesma alteração da 3.2, aplicada ao `editingItems` e ao `handleAddProduct`. Itens existentes precisam ser exibidos com a variação que já está salva (já vem de `OrderItem.variantNameSnapshot` via serializer — verificar que `serializeOrder` está expondo isso, hoje só expõe `productName`).

> ⚠️ **Lacuna do serializer:** `lib/database.ts` não inclui `variantId`/`variantName` no serializador de `Order` que vai para o admin. Atualmente o nome da variação fica embutido no `productNameSnapshot` (formato `"Produto (Variação)"` em `app/api/orders/route.ts:233`). Para a edição funcionar bem, é melhor:
> - Garantir que `OrderItem.variantId` e `OrderItem.variant.name` estejam no payload de `/api/pedidos/[id]`.
> - Manter o snapshot textual (não quebra histórico de pedidos antigos).

### 3.4 API admin — `/api/pedidos` (`POST` e `PUT`)

Acrescentar **revalidação server-side** equivalente à de `/api/orders`:

```ts
for (const item of items) {
  const product = await prisma.product.findUnique({
    where: { id: item.productId },
    include: { variants: true },
  })
  if (!product) return 400 'Produto inexistente'
  if (product.variants.length > 0 && !item.variantId) {
    return 400 `Selecione uma variação para ${product.name}`
  }
  if (item.variantId) {
    const variant = product.variants.find(v => v.id === item.variantId)
    if (!variant) return 400 'Variação inválida'
  }
  // Permite admin furar estoque (decisão: admin sabe o que faz). Apenas valida existência.
}
```

> **Decisão confirmada (stakeholder):** o admin **pode** criar pedido com variação esgotada/inativa. Mostrar badge "Esgotado · admin pode forçar" no picker, mas não bloquear. A regra de não-furar estoque vale só para o site público.

### 3.5 Site — `CartDrawer` (FORA DE ESCOPO)

> **Decisão confirmada (stakeholder):** o site (página de produto + carrinho) já está OK. O problema reportado era exclusivamente na área administrativa. **Não mexer no `CartDrawer` nesta entrega.**

Manter como follow-up possível: ação "Trocar variação" inline no carrinho. Reabrir só se virar pedido explícito.

### 3.6 Critérios de aceite — Parte A

- [ ] Em `/admin/pedidos` (modal Novo Pedido): produto com variantes só pode ser adicionado depois de escolher uma variação. Aparece preço efetivo da variação selecionada.
- [ ] Em `/admin/pedidos/[id]` (modal Editar Itens): mesmo comportamento. Itens existentes do pedido mostram a variação salva.
- [ ] `OrderItem.variantId` é gravado quando admin cria pedido pelo painel.
- [ ] `/api/pedidos` rejeita `POST` com produto que tem variantes mas sem `variantId` (HTTP 400, mensagem clara).
- [ ] Admin pode adicionar variações esgotadas/inativas ao pedido (badge "Esgotado · admin pode forçar"), mas não fura validação.
- [ ] No site, fluxo público continua intacto (regressão zero em `app/produtos/[slug]/ProductDetailClient.tsx`). `CartDrawer` **não** é alterado.

---

## 4. Proposta — Parte B: Produtos internos (admin-only)

### 4.1 Schema — campo novo em `Product`

```prisma
model Product {
  // ...
  visibility String @default("public")  // 'public' | 'internal'
  // ...
  @@index([visibility, isActive])
}
```

**Por que `String` e não `enum`?** O projeto já trata enums via convenção de string (`status`, `paymentStatus`, `fulfillmentStatus`). Mantenho consistência e evito migration de enum (mais cara em Postgres).

**Migration:**
```sql
ALTER TABLE "Product" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'public';
CREATE INDEX "Product_visibility_isActive_idx" ON "Product"("visibility", "isActive");
```
Default `'public'` é seguro: todos os produtos pré-existentes ficam públicos (estado atual).

### 4.2 Tipos (`lib/types.ts`)

```ts
export type ProductVisibility = 'public' | 'internal'

export interface Product {
  // ...
  visibility?: ProductVisibility  // default 'public' no serializer
  // ...
}
```

### 4.3 Filtros — onde `visibility = 'internal'` deve sumir

| Local | Comportamento esperado |
|---|---|
| `lib/catalog.ts → getPublicProductWhere` | adicionar `visibility: 'public'` ao `where`. |
| `lib/catalog.ts → getLocalCatalogProductBySlug` | mesmo (slug de produto interno retorna `null` no site). |
| `lib/catalog.ts → getPublicCatalogCategories` | mesmo (categoria que só tem produtos internos não aparece no site). |
| `app/sitemap.ts` (se existir) e `app/api/products` | excluir interno. |
| Busca pública (`?search=`) | excluir interno. |
| `RestockAlert` no site | botão de "avise-me" não aparece para produto interno (e a API rejeita). |
| `ProductCard`, `Reviews` no site | nunca recebem produtos internos (já filtrado upstream). |
| `/admin/produtos` (lista) | mostra todos, com **badge "Interno"** nos cards. Filtro novo "Interno" no chip-bar. |
| `/admin/pedidos` (modais novo/editar pedido) | mostra todos os produtos ativos, incluindo internos. |

### 4.4 UI admin — formulário de produto

No editor de produto (step "Básico" em `app/admin/produtos/page.tsx`):
- **Toggle / radio** "Visibilidade":
  - `(•) Público — aparece na loja`
  - `( ) Interno — só admin pode usar em pedidos`
- Helper text abaixo: *"Produtos internos não aparecem na loja, busca, sitemap ou recomendações. Use para itens de revenda, brindes, kits sob encomenda ou ajustes manuais."*
- Badge "Interno" no card do produto na grid (canto superior direito, cor neutra `#6B7494`).

### 4.5 UI admin — pedidos

No card de produto dentro dos modais de pedido, badge "Interno" pequena ao lado do nome quando `product.visibility === 'internal'`. Sem bloqueio: admin pode adicionar normalmente.

### 4.6 Validação server-side

**`/api/orders` (checkout público) — bloquear produto interno:**

```ts
if (product.visibility === 'internal') {
  return NextResponse.json(
    { error: 'Um item do carrinho não está disponível.' },
    { status: 400 },
  )
}
```
Mensagem genérica de propósito (não vazar a existência do SKU interno).

**`/api/pedidos` (admin) — não bloqueia:**
Apenas valida que o produto existe e (se aplicável) tem variação válida. Visibilidade não importa.

**`/api/products/restock-alerts` — bloquear produto interno:**
Retornar 404 (como se não existisse), pelo mesmo motivo de não vazamento.

### 4.7 Audit log

Quando `visibility` muda de `public ↔ internal`, registrar em `AuditLog`:
- `action: 'product.visibility.change'`
- `summary: 'Produto X marcado como interno'` (ou `público`)

Isso fecha o ciclo de governança: alguém precisa saber se um produto sumiu da loja por troca de visibilidade.

### 4.8 Critérios de aceite — Parte B

- [ ] Admin consegue marcar produto como Interno via formulário.
- [ ] Produto interno **não** aparece em `/produtos`, `/produtos/[slug]`, busca pública, sitemap, listagem de categoria.
- [ ] Cliente comum recebe 404 ao acessar slug de produto interno.
- [ ] Cliente comum recebe 400 genérico se tentar criar pedido com `productId` interno (request manipulado).
- [ ] Admin consegue adicionar produto interno em pedido novo e em pedido existente.
- [ ] Pedido criado com produto interno funciona normalmente (produção, fulfillment, refund, etc.) — não há regra especial pós-pedido.
- [ ] Migration roda em produção sem downtime (default seguro).
- [ ] AuditLog registra mudanças de visibilidade.

---

## 5. Plano de implementação (ordem sugerida)

### Bloco 1 — Schema + tipos (não-quebra) ~30 min
- Migration `add_product_visibility`.
- Atualizar `lib/types.ts` (campo opcional).
- Atualizar `serializeProduct` em `lib/database.ts` para expor o campo (default `'public'`).

### Bloco 2 — Variantes no admin (Parte A core) ~2h
- Atualizar `listProducts` para incluir variantes.
- Extrair helpers `variantEffectivePrice` / `describeVariant` para `lib/products/variant-pricing.ts`.
- Refazer modal "Novo Pedido" em `/admin/pedidos/page.tsx` com sub-popover de variação.
- Refazer modal "Editar Itens" em `/admin/pedidos/[id]/page.tsx` (idem).
- Validação server-side em `/api/pedidos` POST/PUT.
- Garantir `variantId` no serializer de pedidos para o admin.

### Bloco 3 — Filtros públicos (Parte B core) ~1h
- `getPublicProductWhere` filtra `visibility: 'public'`.
- `app/api/products/restock-alerts` rejeita produto interno.
- Validação em `/api/orders` para rejeitar `internal`.
- Sitemap (`app/sitemap.ts` se existir) ignora interno.

### Bloco 4 — UI admin (Parte B) ~1h
- Toggle de visibilidade no formulário do produto.
- Badge "Interno" nos cards e nos modais de pedido.
- Filtro "Interno" no chip-bar de `/admin/produtos`.
- AuditLog na rota PUT de `/api/produtos`.

### Bloco 5 — Testes e validação ~1h
- Plano de teste manual (seção 6).
- E2E Playwright para os fluxos críticos.

---

## 6. Plano de teste manual

### 6.1 Variação no admin
1. Criar produto **com** variantes pelo `/admin/produtos`.
2. Em `/admin/pedidos` clicar "+ Novo Pedido" → escolher esse produto → confirmar que aparece picker de variação.
3. Selecionar variação A, adicionar. Selecionar variação B, adicionar. Confirmar duas linhas separadas no pedido.
4. Salvar pedido → abrir em `/admin/pedidos/[id]` → confirmar que cada linha mostra a variação correta.
5. Abrir modal "Editar Itens" → confirmar que itens existentes vêm com variação preenchida.
6. Tentar adicionar produto sem variantes → deve adicionar direto (sem picker).
7. Postar `POST /api/pedidos` via curl com produto-com-variantes mas sem `variantId` → deve receber 400.

### 6.2 Variação no site (regressão — não mudou)
1. Página de produto com variantes → continua exigindo seleção antes de "Adicionar ao carrinho".
2. Adicionar variação A, depois variação B → carrinho com 2 linhas (igual hoje).
3. Checkout → pedido criado com `OrderItem.variantId` correto (igual hoje).

### 6.3 Produto interno
1. Marcar produto X como "Interno" no admin → confirmar badge no card.
2. Acessar `/produtos` → produto X **não** aparece.
3. Acessar `/produtos/slug-do-x` → 404.
4. `GET /api/products` → não retorna X.
5. `GET /api/products?search=X` → não retorna X.
6. Pegar `productId` de X e tentar `POST /api/orders` (cliente logado) → 400 genérico.
7. No admin, criar novo pedido → X aparece na lista, pode ser adicionado.
8. Pedido com X processa fulfillment, payment, etc., normalmente.
9. Voltar produto X para "Público" → reaparece em `/produtos`.
10. AuditLog mostra registro de mudança de visibilidade.

---

## 7. Riscos e considerações

| Risco | Mitigação |
|---|---|
| Pedidos antigos têm nome de variação embutido em `productNameSnapshot` ("Produto (Variação)") e podem **não** ter `variantId` populado se a variante foi removida. | Modal de edição cai num modo "somente leitura" para esses itens (mostra texto, sem dropdown). Não tenta resolver `variantId` retroativamente. |
| Admin remove variante usada em pedidos abertos. | Não bloquear a remoção (já existe `onDelete: SetNull` em `OrderItem.variantId` via `ProductVariant` — confirmar). Pedido em produção continua com snapshot textual. |
| Produto vira `internal` mas há pedidos abertos em produção. | Permitido. `ProductionTask` segue normal. Cliente já não consegue ver o produto, mas o pedido dele ainda existe. |
| URL pública de produto interno é descoberta via Google (cache antigo). | Após migration, `getLocalCatalogProductBySlug` retorna `null` → 404 do Next. Cache do Google expira. Adicionar `noindex` na rota dinâmica como cinto-e-suspensório. |
| `Product.visibility` colide com `Product.isActive`. | `isActive=false AND visibility='public'` → some de tudo (já era assim). `isActive=true AND visibility='internal'` → só admin. Documentar que `visibility` é independente de `isActive`/`status`. |
| Performance da query pública. | Index composto `(visibility, isActive)` cobre o filtro mais comum. |

---

## 8. Fora de escopo (follow-ups possíveis)

- Permissão fina por papel (ex.: somente `superadmin` pode marcar como interno) — hoje basta `isAdminRole`.
- Catálogo B2B com login dedicado para revendedores (caso de uso real para "produtos internos + clientes específicos") — virá em outra SPEC se virar requisito.
- Bulk action "marcar N produtos como internos" em `/admin/produtos` — fácil de plugar depois sobre o `bulk` route existente (`app/api/produtos/bulk/route.ts`).
- Histórico de variações em pedidos: hoje só temos snapshot textual. Versionamento real (`ProductVariantSnapshot`) é caro, não justifica agora.

---

## 9. Aprovações necessárias

- [x] Stakeholder: admin pode furar estoque/inativo em pedido manual (seção 3.4).
- [x] Stakeholder: site/carrinho fora de escopo — problema era só na área administrativa (seção 3.5).
- [x] Stakeholder: nomenclatura `visibility: 'public' | 'internal'` aprovada.
- [ ] Engenharia: revisa migration e índice (seção 4.1).
- [ ] Segurança: confirma estratégia de mensagem genérica para produto interno em rota pública (seção 4.6).
