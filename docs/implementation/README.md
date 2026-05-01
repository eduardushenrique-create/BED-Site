# Plano de implementação — BED Design

Documentação central das próximas evoluções do site. Cada fase tem seu próprio arquivo com requisitos, modelagem, contratos de API, telas, critérios de aceite e plano de testes.

## Arquitetura atual (resumo)

- **Framework:** Next.js 16 (App Router) + TypeScript
- **DB:** PostgreSQL via Prisma 7 (driver adapter `@prisma/adapter-pg`) hospedado no Railway
- **Fallback:** `lib/localDb.ts` (JSON em disco) quando `hasDatabase=false` — usado só em dev sem banco
- **Auth:** sessão JWT em cookie httpOnly (TTL 7 dias) — `lib/auth.ts` + `lib/session-token.ts`
- **Auth strategies disponíveis:**
  - OTP por e-mail (Resend) — `/api/auth/request-code` + `/api/auth/verify-code`
  - E-mail + senha (admin) — `/api/auth/password-login` (bcrypt)
  - Google OAuth — `/api/auth/google/{start,callback}`
- **Pagamento:** Mercado Pago (Pix direto + Checkout Pro para cartão) — `lib/mercadopago.ts` + `lib/payment.ts`
- **Frete:** Melhor Envio — `lib/shipping.ts`
- **E-mail:** Resend — `lib/email.ts`

## Roles existentes

`customer | support | orders_manager | catalog_manager | admin | owner | global_admin`

Definidas em `lib/auth.ts:10`. Quem é admin vs cliente é decidido por `OWNER_EMAILS` / `ADMIN_EMAILS` (env vars) — ver `lib/auth-users.ts:19`.

## Convenções deste plano

- Todos os endpoints novos do cliente vivem sob `/api/me/*` e usam `requireApiUser` (não admin).
- Tabelas novas vêm com migration Prisma (NUNCA salvar `migration.sql` com BOM — ver incidente anterior).
- Toda nova rota cliente-side fica sob `/minha-conta/*` ou `/meus-pedidos/*`.
- Schema-first: alterar `prisma/schema.prisma` → gerar migration → atualizar `lib/database.ts` (serializers) → atualizar `lib/localDb.ts` (types do fallback) → expor via API → consumir no front.

## Fases

| Fase | Escopo | Tamanho | Status |
|---|---|---|---|
| [01 — Conta do cliente (mínimo viável)](phases/01-customer-account-mvp.md) | Header logado + `/meus-pedidos` + detalhe + `/api/me/orders` | 1 PR médio | 📋 planejado |
| [02 — Dados pessoais e endereços salvos](phases/02-customer-profile-addresses.md) | Editar perfil + CRUD endereços + pré-popular checkout | 1 PR + migração | 📋 planejado |
| [03 — UX e descoberta](phases/03-ux-discovery.md) | Busca, wishlist, cupom no checkout, esqueci senha | 2-3 PRs | 📋 planejado |
| [04 — Admin operacional](phases/04-admin-operational.md) | Dashboard, cupons CRUD, drill-down cliente, rastreio | 2 PRs | 📋 planejado |
| [05 — Compliance + observability](phases/05-compliance-observability.md) | LGPD, Sentry, rate-limit, testes | 1-2 PRs | 📋 planejado |

## Documentos de apoio

- [Glossário de domínio](glossary.md) — termos do negócio + nome técnico
- [Padrões de código](coding-standards.md) — estrutura de pastas, naming, tratamento de erros
- [Modelagem completa do schema](schema-evolution.md) — todas as tabelas atuais + as que serão adicionadas
- [Catálogo de endpoints](api-catalog.md) — todos os endpoints atuais + novos por fase

## Premissas validadas

- Schema atual já tem `Customer` modelado, mas **sem** `CustomerAddress`, **sem** vínculo `Order ↔ Customer` (apenas `customerEmail` como string), e **sem** `Wishlist`/`Review`/`PasswordResetToken`. Cada fase nova traz suas próprias migrations.
- Carrinho hoje vive só em context React (não persiste em DB) — ver `context/CartContext.tsx`. Fase 3 cobre a persistência opcional.
- O modelo `Cart`/`CartItem` no schema **existe mas não é usado pela aplicação** — Fase 3 decide se ressuscitar ou remover.
