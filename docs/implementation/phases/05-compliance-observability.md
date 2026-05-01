# Fase 05 — Compliance + observability

> Objetivo: deixar o site pronto para escala — LGPD, monitoramento de erros, anti-abuso, testes.

## Escopo

1. **LGPD**: banner de cookies, exclusão de conta, exportar meus dados
2. **Sentry** (ou alternativa): rastreamento de erros em produção
3. **Rate limiting** em endpoints públicos
4. **Captcha** em formulários abertos
5. **Logs estruturados** (pino ou similar)
6. **Testes E2E** (Playwright) cobrindo fluxos críticos
7. **CI/CD**: lint + typecheck + testes antes do merge

---

## 1. LGPD

### Banner de cookies
- Componente `<CookieConsent />` montado no `SiteShell`
- Banner não-modal no fundo da tela na primeira visita
- 2 botões: "Aceitar todos" e "Apenas essenciais"
- Persistência via cookie `lgpd-consent=full|essential` (1 ano)
- Se usuário negar não-essenciais, NÃO carregar Google Analytics/pixel/etc

### Exclusão de conta
- Tela `/minha-conta/excluir-conta` com aviso forte + confirmação
- Endpoint `DELETE /api/me` (requer reautenticação por código OTP)
- Effect: anonimiza customer (e-mail vira `deleted-{id}@example.com`, nome vira "Cliente removido"), preserva pedidos para histórico fiscal, deleta endereços, wishlist, tokens
- Encerra sessão

### Exportar meus dados
- Botão em `/minha-conta` "Baixar meus dados"
- Endpoint `GET /api/me/export` retorna JSON com:
  - Dados pessoais
  - Endereços
  - Histórico de pedidos
  - Wishlist
  - Logs de acesso (se houver)
- Headers: `Content-Disposition: attachment; filename=meus-dados-bd-design.json`

### Política de retenção
- Documentar em `docs/lgpd-data-retention.md`:
  - Pedidos: 5 anos (obrigação fiscal)
  - Logs de auth: 6 meses
  - Customer anonimizado: indefinido (mas sem PII)

---

## 2. Sentry

### Setup
- ENV: `SENTRY_DSN`, `SENTRY_AUTH_TOKEN` (para sourcemaps)
- Pacote: `@sentry/nextjs`
- Configuração em `sentry.client.config.ts` e `sentry.server.config.ts`
- Capturar erros de:
  - Server actions
  - API routes (wrap genérico)
  - Webhooks (já temos try/catch — adicionar `Sentry.captureException`)
- **Filtrar PII**: scrub de e-mail/CPF/CEP no `beforeSend`

### Alternativa
- Se quiser self-hosted: GlitchTip (compatível com SDK Sentry, $5/mês na fly.io)

---

## 3. Rate limiting

Vulnerabilidades atuais:
- `/api/auth/request-code` — pode ser usado para spam de e-mail
- `/api/auth/verify-code` — bruteforce de código de 6 dígitos
- `/api/auth/password-login` — bruteforce
- `/api/coupons/validate` — enumeration de cupons
- `/api/contato` (se existir) — spam

### Solução
- Pacote `@upstash/ratelimit` + Upstash Redis (free tier)
- Helper `lib/rate-limit.ts`:
  ```ts
  export async function rateLimit(key: string, limit: number, windowSec: number)
  ```
- Aplicar em middleware das rotas críticas

### Limites recomendados
| Endpoint | Limite | Janela |
|---|---|---|
| `request-code` | 3 | 10 min por e-mail + 10 por IP |
| `verify-code` | 5 | 10 min por e-mail |
| `password-login` | 5 | 10 min por e-mail + 20 por IP |
| `coupons/validate` | 10 | 1 min por IP |

Em caso de exceder, retornar 429 com `Retry-After`.

---

## 4. Captcha

### Solução
- Cloudflare Turnstile (free, sem-bot UX)
- Aplicar em:
  - Formulário de contato
  - `/api/auth/request-code` (após 1ª tentativa por IP)
  - Cadastro (Fase 1, se criarmos tela explícita)

### Setup
- ENV: `TURNSTILE_SITE_KEY` (público), `TURNSTILE_SECRET_KEY` (servidor)
- Componente `<Turnstile siteKey={...} onVerify={...} />`
- Validação server-side: `POST` para `https://challenges.cloudflare.com/turnstile/v0/siteverify`

---

## 5. Logs estruturados

### Hoje
`console.log/error` direto. Em produção (Railway), aparecem como linhas soltas, difíceis de filtrar.

### Solução
- Pacote `pino` + `pino-pretty` em dev
- Helper `lib/logger.ts`:
  ```ts
  export const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    base: { env: process.env.NODE_ENV, service: 'bed-design' }
  })
  ```
- Substituir `console.error` em arquivos críticos: `lib/database.ts`, `lib/catalog.ts`, `lib/mercadopago.ts`, `app/api/webhooks/*`

### Convenção
```ts
logger.info({ orderNumber, status }, 'order status updated')
logger.error({ err, paymentId }, 'mercadopago webhook failed')
```

---

## 6. Testes E2E

### Estado atual
- `tests/e2e.spec.ts` existe mas tem erros de tipo (visto no `tsc --noEmit`)
- Não roda em CI

### Cobertura mínima
- Fluxo crítico: visitante → adiciona produto → checkout → cria pedido (mock MP)
- Login OTP completo (mockando e-mail enviado — extrair código do log)
- Cliente vê próprios pedidos
- Cliente NÃO vê pedidos de outro
- Admin acessa painel (com guard 403 se não admin)

### Setup
- Corrigir tipos em `tests/e2e.spec.ts`
- `playwright.config.ts` já existe — validar baseURL para CI
- Banco de testes: usar Postgres em container Docker no CI

---

## 7. CI/CD

### Atual
- Railway dispara build no push para `main`
- Sem gate de lint/typecheck/teste

### Proposta — GitHub Actions
`.github/workflows/ci.yml`:
```yaml
on: [pull_request]
jobs:
  ci:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx prisma generate
      - run: npx prisma migrate deploy
        env: { DATABASE_URL: postgres://postgres:test@localhost:5432/postgres }
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npx playwright test
```

Branch protection no GitHub: main exige checks verdes para merge.

---

## Arquivos a criar/modificar

| Tipo | Caminho |
|---|---|
| 🆕 | `components/CookieConsent.tsx` |
| 🆕 | `app/minha-conta/excluir-conta/page.tsx` |
| 🆕 | `app/api/me/route.ts` (DELETE handler) |
| 🆕 | `app/api/me/export/route.ts` |
| 🆕 | `docs/lgpd-data-retention.md` |
| 🆕 | `sentry.client.config.ts`, `sentry.server.config.ts`, `next.config.ts` (withSentry) |
| 🆕 | `lib/rate-limit.ts` |
| ✏️ | `app/api/auth/request-code/route.ts` (rate limit + turnstile) |
| ✏️ | `app/api/auth/verify-code/route.ts` (rate limit) |
| ✏️ | `app/api/auth/password-login/route.ts` (rate limit) |
| 🆕 | `lib/logger.ts` |
| 🆕 | `.github/workflows/ci.yml` |
| ✏️ | `tests/e2e.spec.ts` (corrigir tipos + estender) |

## Critérios de aceite

### LGPD
- [ ] Banner aparece na 1ª visita; some após escolha
- [ ] Aceitar/recusar persiste em cookie
- [ ] Exclusão de conta exige código por e-mail
- [ ] Após exclusão, login com mesmo e-mail cria nova conta (anonimização efetiva)
- [ ] Exportar dados retorna JSON válido com tudo do usuário

### Sentry
- [ ] Erro forçado em prod aparece no dashboard
- [ ] PII não vaza nos eventos

### Rate limit
- [ ] 4ª tentativa de `request-code` em 10min retorna 429
- [ ] Header `Retry-After` correto

### Logs
- [ ] Todos os `console.error` críticos viraram `logger.error` com contexto
- [ ] Em dev, pino-pretty formata legível
- [ ] Em prod, JSON estruturado

### CI
- [ ] PR com erro de lint não merga
- [ ] PR com erro de typecheck não merga
- [ ] Teste Playwright passa

## Decisões pendentes

1. **Sentry vs alternativa:** custo. Sentry tem free tier de 5k events/mês — provavelmente suficiente. OK?
2. **Upstash Redis:** free tier 10k requests/day. Suficiente para rate limit. OK?
3. **Turnstile vs hCaptcha:** Turnstile é mais simples e free unlimited. OK?

## Riscos

- **Anonimização irrevogável:** uma vez excluída a conta, e-mail liberado para novo cadastro. Não permite restauração. Documentar bem.
- **Rate limit em ambiente single-region:** Upstash funciona globalmente, mas latência add ~30ms por request. Aceitável.
- **CI lento:** Playwright sobe DB + builda Next. ~3-5 min por PR. OK para volume atual.
