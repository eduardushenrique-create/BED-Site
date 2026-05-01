# Catálogo de APIs

Lista de todos os endpoints (atuais + planejados). `🟢` existe. `🟡` planejado por fase.

## Auth — `/api/auth/*`

| Método | Rota | Auth | Descrição | Status |
|---|---|---|---|---|
| POST | `/api/auth/request-code` | público | Envia OTP por e-mail | 🟢 |
| POST | `/api/auth/verify-code` | público | Verifica OTP, cria sessão | 🟢 |
| POST | `/api/auth/password-login` | público | Login com senha (admin) | 🟢 |
| GET | `/api/auth/google/start` | público | Inicia OAuth Google | 🟢 |
| GET | `/api/auth/google/callback` | público | Callback OAuth Google | 🟢 |
| POST | `/api/auth/logout` | público | Limpa cookie de sessão | 🟢 |
| GET | `/api/auth/me` | público | Retorna user da sessão (ou null) | 🟢 |
| POST | `/api/auth/forgot-password` | público | Envia link de reset (admin) | 🟡 Fase 3 |
| POST | `/api/auth/reset-password` | público | Aplica nova senha via token | 🟡 Fase 3 |

## Cliente logado — `/api/me/*`

| Método | Rota | Auth | Descrição | Status |
|---|---|---|---|---|
| GET | `/api/me` | customer | Perfil completo do cliente | 🟡 Fase 2 |
| PATCH | `/api/me` | customer | Atualiza nome/telefone/CPF | 🟡 Fase 2 |
| DELETE | `/api/me` | customer | Anonimiza conta (LGPD) | 🟡 Fase 5 |
| GET | `/api/me/orders` | customer | Lista pedidos do cliente | 🟡 Fase 1 |
| GET | `/api/me/addresses` | customer | Lista endereços salvos | 🟡 Fase 2 |
| POST | `/api/me/addresses` | customer | Cria endereço | 🟡 Fase 2 |
| PUT | `/api/me/addresses/[id]` | customer | Atualiza endereço | 🟡 Fase 2 |
| DELETE | `/api/me/addresses/[id]` | customer | Remove endereço | 🟡 Fase 2 |
| GET | `/api/me/wishlist` | customer | Lista favoritos | 🟡 Fase 3 |
| POST | `/api/me/wishlist` | customer | Adiciona favorito | 🟡 Fase 3 |
| DELETE | `/api/me/wishlist/[productId]` | customer | Remove favorito | 🟡 Fase 3 |
| GET | `/api/me/export` | customer | Exporta JSON dos dados (LGPD) | 🟡 Fase 5 |

## Catálogo público — `/api/products`, `/api/categories`, `/api/banners`

| Método | Rota | Auth | Descrição | Status |
|---|---|---|---|---|
| GET | `/api/products` | público | Lista produtos públicos (filtros: category, featured, personalizable, search) | 🟢 |
| GET | `/api/categories` | público | Lista categorias com produtos publicados | 🟢 |
| GET | `/api/banners` | admin | Lista todos banners | 🟢 (somente admin) |

> Banners ativos do storefront são lidos via SSR direto de `lib/database.ts:listBanners` em `app/page.tsx` (não via API).

## Pedidos

| Método | Rota | Auth | Descrição | Status |
|---|---|---|---|---|
| GET | `/api/orders/[orderNumber]` | customer (dono) ou admin | Detalhe de um pedido | 🟢 |
| POST | `/api/orders` | customer | Cria pedido + payment | 🟢 |
| POST | `/api/orders/[orderNumber]/regenerate-pix` | customer (dono) | Gera novo Pix | 🟡 Fase 3 |
| POST | `/api/admin/orders/[orderNumber]/refund` | admin | Reembolso via MP | 🟡 Fase 4 |

## Frete

| Método | Rota | Auth | Descrição | Status |
|---|---|---|---|---|
| POST | `/api/shipping/calculate` | público | Cota frete via Melhor Envio | 🟢 |

## Cupons

| Método | Rota | Auth | Descrição | Status |
|---|---|---|---|---|
| POST | `/api/coupons/validate` | público | Valida cupom para subtotal | 🟡 Fase 3 |
| GET | `/api/cupons` | admin | Lista cupons | 🟡 Fase 4 |
| POST | `/api/cupons` | admin | Cria cupom | 🟡 Fase 4 |
| PUT | `/api/cupons` | admin | Atualiza cupom | 🟡 Fase 4 |
| DELETE | `/api/cupons?id=X` | admin | Apaga cupom | 🟡 Fase 4 |

## Admin — CRUD

| Método | Rota | Auth | Descrição | Status |
|---|---|---|---|---|
| GET/POST/PUT/DELETE | `/api/produtos` | admin | CRUD produtos | 🟢 |
| GET/POST/PUT/DELETE | `/api/categorias` | admin | CRUD categorias | 🟢 |
| GET/POST/PUT/DELETE | `/api/banners` | admin | CRUD banners | 🟢 |
| GET/POST/PUT/DELETE | `/api/clientes` | admin | CRUD clientes | 🟢 |
| GET/POST/PUT/DELETE | `/api/pedidos` | admin | CRUD pedidos | 🟢 |
| GET | `/api/clientes/[id]` | admin | Detalhe cliente + pedidos | 🟡 Fase 4 |

## Admin — Dashboards

| Método | Rota | Auth | Descrição | Status |
|---|---|---|---|---|
| GET | `/api/admin/stats` | admin | Métricas do dashboard | 🟡 Fase 4 |

## Webhooks

| Método | Rota | Auth | Descrição | Status |
|---|---|---|---|---|
| POST | `/api/webhooks/mercadopago` | HMAC | Atualiza pedido via webhook MP | 🟢 |
| GET | `/api/webhooks/mercadopago` | público | Healthcheck | 🟢 |
| POST | `/api/webhooks/melhorenvio` | HMAC | Atualiza Shipment via webhook ME | 🟡 Fase 4 |

## Convenções de resposta

### Sucesso
```json
{ "success": true, "data": { ... } }
```
ou retorno direto do recurso para CRUD simples.

### Erro
```json
{ "error": "mensagem amigável", "code": "OPCIONAL" }
```

### Paginação (planejada)
```json
{ "items": [...], "total": 47, "limit": 20, "offset": 0 }
```

## HTTP status conventions

| Código | Quando usar |
|---|---|
| 200 | Sucesso |
| 201 | Criado |
| 204 | Sucesso sem body (DELETE) |
| 400 | Input inválido |
| 401 | Sem auth |
| 403 | Sem permissão |
| 404 | Não encontrado |
| 409 | Conflito (uniq violation, etc.) |
| 429 | Rate limit (Fase 5) |
| 500 | Erro interno |

## Headers padrão

- Todas as respostas JSON: `Content-Type: application/json; charset=utf-8`
- Endpoints sensíveis: `Cache-Control: no-store`
- CORS: não habilitado (mesmo origin)
