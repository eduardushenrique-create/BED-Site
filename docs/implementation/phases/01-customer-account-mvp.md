# Fase 01 — Conta do cliente (MVP)

> Objetivo: dar ao cliente que comprou hoje o mínimo para acompanhar o pedido amanhã. Sem isso, todo cliente precisa salvar o link `/pedido-confirmado?pedido=XXX` ou pedir info via WhatsApp.

## Escopo

### Inclui
- Header com estado de login (avatar/iniciais + dropdown ou botão "Entrar")
- Página `/meus-pedidos` (lista paginada do cliente logado)
- Página `/meus-pedidos/[orderNumber]` (detalhe do pedido)
- Endpoint `GET /api/me/orders` (lista pedidos do cliente da sessão)
- Botão de logout funcional
- Polimento visual da página `/login` (separar "entrar" de "criar conta" no fluxo OTP)

### Não inclui (vai pra Fase 2)
- Editar dados do cliente
- Endereços salvos
- Esqueci minha senha

## Mudanças no schema

**Nenhuma.** Esta fase usa só o que já existe (`Customer`, `Order`, `OrderItem`, `Address`, `Payment`, `Shipment`).

> ⚠️ **Atenção:** `Order` hoje guarda `customerEmail` como string, mas **não tem FK para `Customer.id`**. A query de "meus pedidos" filtra por `WHERE customerEmail = session.email`. Funciona mas é frágil (e-mail digitado errado no checkout = pedido órfão). A Fase 2 adiciona a FK opcional.

## Endpoints novos

### `GET /api/me/orders`

**Auth:** `requireApiUser`

**Query params:**
- `status` (opcional): filtra por status (`pending_payment`, `paid`, `cancelled`, etc.)
- `limit` (opcional, default 20, max 50)
- `offset` (opcional, default 0)

**Response 200:**
```json
{
  "orders": [
    {
      "orderNumber": "B&D-MABCD-XYZW",
      "status": "paid",
      "paymentStatus": "paid",
      "total": 142.50,
      "createdAt": "2026-04-25T18:32:11Z",
      "itemCount": 2,
      "trackingCode": "BR123456789BR"
    }
  ],
  "total": 47,
  "limit": 20,
  "offset": 0
}
```

**Implementação:** novo arquivo `app/api/me/orders/route.ts`. Usa `prisma.order.findMany` com `where: { customerEmail: user.email }` e fallback `localDb` consistente.

### `GET /api/me/orders/[orderNumber]`

**Status:** já existe via `/api/orders/[orderNumber]` ([app/api/orders/\[orderNumber\]/route.ts](../../app/api/orders/[orderNumber]/route.ts)). O guard de "dono" já está implementado (linha 22).

**Decisão:** **reutilizar** o existente. A página `/meus-pedidos/[orderNumber]` chama `GET /api/orders/[orderNumber]` direto.

### `POST /api/auth/logout`

**Status:** já existe ([app/api/auth/logout/route.ts](../../app/api/auth/logout/route.ts)). Falta apenas chamar do frontend.

## Telas

### Header (`components/Header.tsx`)

Substituir o ícone de busca + carrinho atuais por:
```
[Logo]   Início  Produtos  Personalizados  Presentes  Sobre  Contato   [🔍] [🛒n] [👤 Olá, Eduardo ▾]
                                                                                  └ Meus pedidos
                                                                                  └ Minha conta
                                                                                  └ Sair
```

Quando deslogado:
```
[Logo]   ...nav...   [🔍] [🛒n] [Entrar]
```

**Implementação:**
- Header vira componente que faz fetch de `/api/auth/me` no mount (ou usa um Context novo `AuthContext`)
- Dropdown com `<details>`/`<summary>` ou estado controlado (`useState`)
- "Sair" chama `POST /api/auth/logout` e dá `router.refresh()`

**Recomendação técnica:** criar `context/AuthContext.tsx` que:
- Faz fetch inicial de `/api/auth/me`
- Expõe `{ user, loading, logout, refresh }`
- Wrap no `SiteShell.tsx` (logo abaixo do `CartProvider`)

### `/meus-pedidos` (`app/meus-pedidos/page.tsx`)

- Server Component que usa `requireUser('/login?redirect=/meus-pedidos')` no topo (já tem em `lib/auth.ts:58`)
- Renderiza tabela/cards com pedidos
- Filtros simples (status: todos / em aberto / pagos / cancelados)
- Estado vazio: "Você ainda não fez nenhum pedido" + CTA "Ver produtos"

**Layout sugerido:**
```
Meus pedidos                              [filtro: todos ▾]

┌─────────────────────────────────────────────────────────┐
│ #B&D-MABCD-XYZW          25/04/2026         R$ 142,50  │
│ ● Pago • 2 itens                          [Ver detalhes]│
│ Rastreio: BR123456789BR                                 │
└─────────────────────────────────────────────────────────┘
```

### `/meus-pedidos/[orderNumber]` (`app/meus-pedidos/[orderNumber]/page.tsx`)

Reaproveitar muito do que já existe em `app/pedido-confirmado/page.tsx`. Adicionar:
- Linha do tempo do status (Pendente → Pago → Em produção → Enviado → Entregue)
- Botão "Cancelar pedido" (só se `status === 'pending_payment'`)
- Botão "Refazer Pix" (se Pix expirado — Fase 3)
- Endereço de entrega visível
- Itens com imagem

### `/login` — polimento

- Separar visualmente em 2 abas: **"Entrar"** | **"Criar conta"**
- Aba "Entrar": só campo de e-mail (envia código) ou e-mail+senha
- Aba "Criar conta": nome (obrigatório) + e-mail (envia código). Após verificar, redireciona para `/minha-conta` (não checkout)
- Manter login com Google em ambas as abas

## Arquivos a criar/modificar

| Tipo | Caminho | Descrição |
|---|---|---|
| 🆕 | `app/api/me/orders/route.ts` | Lista pedidos do cliente |
| 🆕 | `app/meus-pedidos/page.tsx` | Página de listagem |
| 🆕 | `app/meus-pedidos/[orderNumber]/page.tsx` | Página de detalhe |
| 🆕 | `context/AuthContext.tsx` | Provider de sessão no client |
| ✏️ | `components/Header.tsx` | Adicionar dropdown de usuário |
| ✏️ | `components/SiteShell.tsx` | Wrap em AuthProvider |
| ✏️ | `app/login/LoginClient.tsx` | UX em abas + redirect inteligente |
| ✏️ | `lib/database.ts` | Adicionar `listOrdersByCustomerEmail(email, opts)` |

## Critérios de aceite

- [ ] Cliente deslogado vê "Entrar" no header; clicar leva a `/login`
- [ ] Cliente logado vê seu nome (ou iniciais) no header com dropdown
- [ ] "Sair" do dropdown encerra a sessão e header volta ao estado deslogado
- [ ] `/meus-pedidos` lista os pedidos cujo `customerEmail` bate com a sessão
- [ ] Acessar `/meus-pedidos` deslogado redireciona para `/login?redirect=/meus-pedidos`
- [ ] Detalhe de pedido carrega via API existente; cliente NÃO consegue ver pedido de outro
- [ ] Listagem suporta filtro por status (mínimo: todos / pagos / pendentes)
- [ ] Estado vazio funcional ("você ainda não tem pedidos")
- [ ] Header novo não quebra layout em mobile
- [ ] `tsc --noEmit` e `next build` passam

## Plano de testes

### Manual
1. Deslogado → `/meus-pedidos` redireciona para login com `?redirect=/meus-pedidos` ✓
2. Login OTP com e-mail novo → redirecionamento volta para `/meus-pedidos` ✓
3. Lista vazia para conta nova ✓
4. Fazer um pedido com a conta → pedido aparece em `/meus-pedidos` ✓
5. Logar com `customerEmail` errado → não vê o pedido ✓
6. Tentar acessar `/api/orders/PEDIDO-DE-OUTRO-CLIENTE` direto → 403 ✓
7. Logout pelo dropdown → cookie limpo + header volta ao deslogado ✓
8. Layout mobile (< 768px) ✓

### Automatizado (opcional nesta fase)
- Adicionar 2 testes Playwright em `tests/e2e.spec.ts`:
  - "cliente loga e vê /meus-pedidos vazio"
  - "cliente não vê pedido de outro cliente"

## Decisões pendentes

1. **Nome da rota:** `/meus-pedidos` (PT) é coerente com `/produtos`, `/personalizados`. Confirmar.
2. **Auth context:** preferimos `Context React` (client-side fetch) ou passar `user` via prop drilling do server? Recomendação: Context, mais simples para Header reagir.
3. **Persistência de filtro:** query param `?status=paid` na URL ou `localStorage`? Recomendação: query param (compartilhável).

## Riscos

- **Order sem FK para Customer**: se o cliente fizer checkout deslogado com e-mail X, e depois criar conta com e-mail Y, perde o histórico. Mitigação: na hora de criar conta via OTP, fazer "merge" de pedidos cujo `customerEmail = newEmail`. Ou: simplesmente avisar no /login para usar o mesmo e-mail das compras.
- **Volume de pedidos**: paginação de 20/pg cobre o caso comum. Se ultrapassar 1000 pedidos por cliente, revisitar.
