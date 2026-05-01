# Fase 02 — Perfil completo + endereços salvos

> Objetivo: cliente recorrente não digita endereço/CPF/telefone toda vez. Reduz fricção no checkout.

## Escopo

- Página `/minha-conta` (dashboard com resumo + atalhos)
- Página `/minha-conta/dados` (editar nome, telefone, CPF)
- Página `/minha-conta/enderecos` (CRUD de endereços salvos com até N=5)
- Checkout pré-popula o endereço padrão do cliente logado
- Migrações: novo modelo `CustomerAddress`, novos campos em `Customer`, FK opcional em `Order`

## Mudanças no schema

### Novo: `CustomerAddress`
```prisma
model CustomerAddress {
  id           String   @id @default(cuid())
  customerId   String
  customer     Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  label        String?  // ex: "Casa", "Trabalho"
  recipient    String   // nome de quem recebe (pode ser diferente do cliente)
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

### Alterar: `Customer`
```prisma
model Customer {
  id         String   @id @default(cuid())
  name       String
  email      String   @unique
  phone      String?
  cpf        String?              // 🆕
  isVerified Boolean  @default(false)
  addresses  CustomerAddress[]    // 🆕
  orders     Order[]              // 🆕 inverso da FK abaixo
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

### Alterar: `Order` (FK opcional)
```prisma
model Order {
  ...
  customerId   String?              // 🆕 opcional para não quebrar pedidos antigos
  customer     Customer? @relation(fields: [customerId], references: [id])
  ...
}
```

### Migration

Arquivo `prisma/migrations/<timestamp>_customer_profile_addresses/migration.sql`:
```sql
-- Customer.cpf
ALTER TABLE "Customer" ADD COLUMN "cpf" TEXT;

-- Order.customerId (opcional, sem cascade — preserva pedido se cliente apagar conta)
ALTER TABLE "Order" ADD COLUMN "customerId" TEXT;
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL;

-- CustomerAddress
CREATE TABLE "CustomerAddress" (
  "id" TEXT PRIMARY KEY,
  "customerId" TEXT NOT NULL REFERENCES "Customer"("id") ON DELETE CASCADE,
  "label" TEXT,
  "recipient" TEXT NOT NULL,
  "zipCode" TEXT NOT NULL,
  "street" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "complement" TEXT,
  "neighborhood" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "country" TEXT NOT NULL DEFAULT 'BR',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "CustomerAddress_customerId_idx" ON "CustomerAddress"("customerId");

-- Backfill: liga orders existentes ao Customer pelo email
UPDATE "Order" o
SET "customerId" = c.id
FROM "Customer" c
WHERE LOWER(o."customerEmail") = LOWER(c.email)
  AND o."customerId" IS NULL;
```

> ⚠️ Salvar **sem BOM**. Verificar com `head -c 3 ... | xxd` antes de commitar (vide incidente do init migration).

## Endpoints novos

### `GET /api/me`
Retorna o customer logado com perfil completo (não só sessão).

**Response 200:**
```json
{
  "id": "cust_xyz",
  "name": "Eduardo",
  "email": "edu@x.com",
  "phone": "+5511999999999",
  "cpf": "12345678909",
  "createdAt": "..."
}
```

### `PATCH /api/me`
Atualiza campos do customer.

**Body:** `{ name?, phone?, cpf? }` (e-mail NÃO editável aqui — exigiria reverificação)

**Validações:**
- `cpf` valida via `lib/validation.ts:validateCPF`
- `phone` regex `^\d{10,11}$` (após strip de não-dígitos)
- `name` mínimo 2 chars

### `GET /api/me/addresses`
Lista endereços do cliente.

**Response 200:** `[{ ...CustomerAddress }, ...]` ordenado por `isDefault DESC, createdAt DESC`

### `POST /api/me/addresses`
Cria endereço.

**Body:** todos os campos exceto `id`, `customerId`, timestamps.

**Regras:**
- Se for o primeiro endereço do cliente → automaticamente `isDefault: true`
- Se `isDefault: true` for enviado → desmarcar `isDefault` de todos os outros (em transação)
- Limite de 5 endereços por cliente — retornar 400 se exceder

### `PUT /api/me/addresses/[id]`
Atualiza endereço (mesmas regras do POST para `isDefault`).

### `DELETE /api/me/addresses/[id]`
Apaga. Se era default e ainda há outros, promove o mais recente a default.

## Telas

### `/minha-conta` (dashboard)

```
Olá, Eduardo                                                    [Sair]

┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ 📦 Pedidos      │  │ 👤 Dados        │  │ 📍 Endereços    │
│ 12 no total     │  │ Atualizar       │  │ 2 salvos        │
│ Último: 25/04   │  │ perfil          │  │ Casa (padrão)   │
│ [Ver pedidos]   │  │ [Editar]        │  │ [Gerenciar]     │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### `/minha-conta/dados`

Form simples com nome, telefone, CPF. Botão "Salvar". Não permite trocar e-mail (mensagem: "para alterar o e-mail, fale com o suporte").

### `/minha-conta/enderecos`

Lista de cards com endereços. Cada card: ações (editar / excluir / definir como padrão). Botão "+ Novo endereço" abre form em modal ou inline.

Form de endereço reutiliza componentes do checkout (CEP autopreenche via ViaCEP — já tem em `app/checkout/page.tsx:64`).

### Checkout — pré-população

No mount do `/checkout`:
1. Buscar `/api/me` → preenche nome/telefone/CPF se vazios
2. Buscar `/api/me/addresses` → se houver default, preenche endereço
3. Mostrar dropdown "Usar outro endereço salvo" se cliente tem múltiplos

Após finalizar pedido com sucesso, oferecer: "Salvar este endereço para próximas compras?"

## Arquivos a criar/modificar

| Tipo | Caminho | Descrição |
|---|---|---|
| ✏️ | `prisma/schema.prisma` | Customer.cpf, Order.customerId, CustomerAddress |
| 🆕 | `prisma/migrations/<ts>_customer_profile_addresses/migration.sql` | DDL + backfill |
| ✏️ | `lib/database.ts` | Serializers + funções `getCustomerById`, `updateCustomer`, `listAddresses`, `createAddress`, etc. |
| ✏️ | `lib/localDb.ts` | Type CustomerAddress + estender Database |
| 🆕 | `app/api/me/route.ts` | GET + PATCH |
| 🆕 | `app/api/me/addresses/route.ts` | GET + POST |
| 🆕 | `app/api/me/addresses/[id]/route.ts` | PUT + DELETE |
| 🆕 | `app/minha-conta/page.tsx` | Dashboard |
| 🆕 | `app/minha-conta/dados/page.tsx` | Editar perfil |
| 🆕 | `app/minha-conta/enderecos/page.tsx` | CRUD endereços |
| 🆕 | `app/minha-conta/enderecos/AddressForm.tsx` | Componente form (reuso) |
| ✏️ | `app/checkout/page.tsx` | Pré-popular do `/api/me` + dropdown de endereços salvos + opção "salvar para próximas" |
| ✏️ | `lib/api-auth.ts` | Já cobre, sem mudança |

## Critérios de aceite

- [ ] Migration aplica sem erro em produção e backfilla `customerId` para pedidos antigos com e-mail batendo
- [ ] `/minha-conta` mostra contagem real de pedidos do cliente
- [ ] `/minha-conta/dados` salva e persiste alterações
- [ ] `/minha-conta/enderecos` cria, edita, exclui endereços
- [ ] Apenas 1 endereço pode ser default por vez
- [ ] Excluir endereço default promove o mais recente
- [ ] Limite de 5 endereços respeitado
- [ ] Checkout pré-popula com endereço default quando cliente está logado
- [ ] Cliente novo (sem endereço) não quebra checkout
- [ ] Após pedido, modal sugere salvar endereço usado (se ainda não estava salvo)
- [ ] CPF do cliente é validado server-side
- [ ] Endereços de outro cliente retornam 403/404 nas APIs

## Plano de testes

### Manual
1. Cliente novo → checkout sem endereços → fluxo continua manual
2. Cliente com 1 endereço default → checkout pré-popula
3. Cliente com 3 endereços → dropdown lista os 3 + opção "novo"
4. CRUD: criar, editar, excluir, marcar default
5. Backfill: pedido antigo com e-mail batendo aparece em `/meus-pedidos` mesmo após criar conta com mesmo e-mail
6. Tentar criar 6º endereço → erro 400
7. PATCH `/api/me` com CPF inválido → 400

### Automatizado
- Migration aplicada em ambiente de staging com dados sintéticos
- Verificar que `Order.customerId` é populado corretamente no backfill
- Teste Playwright: criar conta → criar endereço → checkout pré-popula

## Decisões pendentes

1. **Limite de endereços:** 5 OK? KaBuM permite 10. Recomendação: 5 inicial, configurável depois.
2. **Endereço de cobrança ≠ entrega?** Hoje só temos endereço de entrega. Para cartão de crédito, MP geralmente não exige cobrança separada. Recomendação: deixar como está (só entrega).
3. **CPF obrigatório no perfil?** No checkout sim, no perfil pode ficar opcional. Recomendação: opcional no perfil.

## Riscos

- **Migration de FK em tabela com dados:** o backfill por e-mail pode falhar se houver caracteres estranhos. Testar em staging com dados reais antes.
- **Race condition no `isDefault`:** sempre rodar a desmarcação dos outros + marcação do novo dentro de `prisma.$transaction`.
- **Compatibilidade fallback `localDb`:** lembrar de adicionar suporte completo nas funções de address — caso contrário, dev sem DB quebra.
