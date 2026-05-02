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
| POST | `/api/auth/request-password-reset` | público | Envia link de reset (admin), 1h TTL, rate-limited | 🟢 |
| POST | `/api/auth/reset-password` | público | Aplica nova senha via token | 🟢 |

## Cliente logado — `/api/me/*`

| Método | Rota | Auth | Descrição | Status |
|---|---|---|---|---|
| GET | `/api/me` | customer | Perfil completo do cliente | 🟢 |
| PATCH | `/api/me` | customer | Atualiza nome/telefone/CPF | 🟢 |
| DELETE | `/api/me` | customer | Anonimiza conta (LGPD) — preserva histórico de pedidos | 🟢 |
| GET | `/api/me/orders` | customer | Lista pedidos do cliente | 🟢 |
| POST | `/api/me/orders/[orderNumber]/cancel` | customer (dono) | Cancela pedido pending payment | 🟢 |
| POST | `/api/me/orders/[orderNumber]/regenerate-pix` | customer (dono) | Gera novo Pix para pedido pending | 🟢 |
| GET | `/api/me/addresses` | customer | Lista endereços salvos | 🟢 |
| POST | `/api/me/addresses` | customer | Cria endereço | 🟢 |
| PUT | `/api/me/addresses/[id]` | customer | Atualiza endereço | 🟢 |
| DELETE | `/api/me/addresses/[id]` | customer | Remove endereço | 🟢 |
| GET | `/api/me/wishlist` | customer | Lista favoritos com Product join | 🟢 |
| POST | `/api/me/wishlist` body=`{productId}` | customer | Adiciona favorito (idempotente) | 🟢 |
| DELETE | `/api/me/wishlist/[productId]` | customer | Remove favorito | 🟢 |
| GET | `/api/me/export` | customer | Exporta JSON com perfil + endereços + pedidos + wishlist (LGPD) | 🟢 |

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
| POST | `/api/orders` | customer | Cria pedido + payment. **502 quando method=card e MP não devolveu checkoutUrl** | 🟢 |
| GET | `/api/pedidos/[id]` | admin | Detalhe pedido por id ou orderNumber | 🟢 |
| POST | `/api/pedidos/[id]/refund` body=`{amount?}` | admin | Reembolso MP (total ou parcial) | 🟢 |
| POST | `/api/me/orders/[orderNumber]/cancel` | customer | Cancela pedido pending | 🟢 |
| POST | `/api/me/orders/[orderNumber]/regenerate-pix` | customer | Gera novo Pix | 🟢 |

## Frete

| Método | Rota | Auth | Descrição | Status |
|---|---|---|---|---|
| POST | `/api/shipping/calculate` | público | Cota frete via Melhor Envio | 🟢 |

## Cupons

| Método | Rota | Auth | Descrição | Status |
|---|---|---|---|---|
| POST | `/api/coupons/validate` | público | Valida cupom para subtotal (body: `{ code, subtotal }`) | ✅ implementado |
| GET | `/api/cupons` | admin | Lista cupons | ✅ implementado |
| POST | `/api/cupons` | admin | Cria cupom | ✅ implementado |
| PUT | `/api/cupons` | admin | Atualiza cupom (body: `{ id, ...campos }`) | ✅ implementado |
| DELETE | `/api/cupons?id=X` | admin | Apaga cupom | ✅ implementado |

## Admin — CRUD

| Método | Rota | Auth | Descrição | Status |
|---|---|---|---|---|
| GET/POST/PUT/DELETE | `/api/produtos` | admin | CRUD produtos | 🟢 |
| GET/POST/PUT/DELETE | `/api/categorias` | admin | CRUD categorias | 🟢 |
| GET/POST/PUT/DELETE | `/api/banners` | admin | CRUD banners | 🟢 |
| GET/POST/PUT/DELETE | `/api/clientes` | admin | CRUD clientes | 🟢 |
| GET/POST/PUT/DELETE | `/api/pedidos` | admin | CRUD pedidos | 🟢 |
| GET | `/api/clientes/[id]` | admin | Detalhe cliente + pedidos + endereços + totais | 🟢 |

## Admin — Dashboards

KPIs do `/admin` são gerados via `lib/database.ts:getAdminDashboardMetrics` (Server Component direto, sem endpoint REST dedicado).

## Webhooks

| Método | Rota | Auth | Descrição | Status |
|---|---|---|---|---|
| POST | `/api/webhooks/mercadopago` | HMAC | Atualiza pedido via webhook MP | 🟢 |
| GET | `/api/webhooks/mercadopago` | público | Healthcheck | 🟢 |
| POST | `/api/webhooks/melhor-envio` | HMAC SHA256 | Atualiza fulfillment via webhook ME, envia emails | 🟢 |

## Restock alerts ("avise quando voltar")

| Método | Rota | Auth | Descrição | Status |
|---|---|---|---|---|
| POST | `/api/products/restock-alerts` body=`{email, productId, variantId?}` | público (rate-limited) | Registra inscrição idempotente | 🟢 |

Disparo automático: `dispatchRestockNotificationsIfNeeded` é chamado após `updateProduct` e `updateProductVariant` quando a disponibilidade volta (filtra `notifiedAt: null`).

## Auditoria admin

| Método | Rota | Auth | Descrição | Status |
|---|---|---|---|---|
| GET | `/api/admin/audit-log?actor=&action=&targetType=&limit=&offset=` | admin | Log paginado | 🟢 |

Hooks: `recordAuditEntry` (best-effort) em refund, update/delete de pedidos, CRUD de cupons, exclusão LGPD de cliente, moderação/exclusão de reviews, CRUD de impressoras, atribuição de tarefas.

## Reviews / avaliações

| Método | Rota | Auth | Descrição | Status |
|---|---|---|---|---|
| GET | `/api/me/reviews?productId=` | customer | Verifica elegibilidade (pedido pago + não-avaliado) | 🟢 |
| POST | `/api/me/reviews` body=`{productId, rating, title?, body?}` | customer | Cria review (status=pending) | 🟢 |
| GET | `/api/products/[id]/reviews` | público | Lista reviews aprovadas + agregado (count, média, distribuição) | 🟢 |
| GET | `/api/avaliacoes?status=&productId=` | admin | Lista para moderação | 🟢 |
| PATCH | `/api/avaliacoes/[id]` body=`{status}` | admin | Aprovar/ocultar | 🟢 |
| DELETE | `/api/avaliacoes/[id]` | admin | Hard delete | 🟢 |

ProductCard e o catálogo público (`getLocalCatalogProducts`/`bySlug`) anexam `averageRating` + `reviewCount` via `getRatingsForProductIds`.

## Impressoras / produção

| Método | Rota | Auth | Descrição | Status |
|---|---|---|---|---|
| GET / POST | `/api/impressoras` | admin | Lista / cadastra impressora | 🟢 |
| GET / PATCH / DELETE | `/api/impressoras/[id]` | admin | Detalhe / edita / exclui (SET NULL nas tarefas) | 🟢 |
| POST | `/api/producao/[id]/assign` body=`{printerId\|null}` | admin | Atribui (ou desatribui) tarefa a uma impressora | 🟢 |

## Anti-bot (Captcha)

Endpoints abaixo aceitam um campo opcional `turnstileToken` no body. Quando `TURNSTILE_SECRET_KEY` está setada, o token é verificado via `lib/turnstile.ts:verifyTurnstileToken`; sem a env, a verificação é pulada (skipped:true).

- `POST /api/auth/request-code`
- `POST /api/auth/password-login`
- `POST /api/auth/request-password-reset`
- `POST /api/products/restock-alerts`

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
