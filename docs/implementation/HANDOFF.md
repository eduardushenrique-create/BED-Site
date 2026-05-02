# Handoff — Sessão BED Design

> **Como usar este documento:** abra uma nova sessão do Claude Code no diretório `C:\PROJETOS\BED-Site` e cole o conteúdo abaixo na primeira mensagem (ou referencie o arquivo `docs/implementation/HANDOFF.md`). O assistente terá contexto completo para continuar de onde paramos.
>
> **Última sessão:** 2026-05-02

---

## 0. Contexto operacional

- **Projeto:** BED Design (Forma 3D) — e-commerce de impressão 3D personalizada
- **Repositório:** https://github.com/eduardushenrique-create/BED-Site
- **Branch principal:** `main`
- **Hospedagem:** Railway (Next + Postgres). Deploy automático no merge para `main`. Migration roda no `start` (`prisma migrate deploy && next start`)
- **Stakeholder:** Edu (eduardus.henrique@gmail.com) — não-técnico, quer reports em linguagem leiga
- **Modo de trabalho:** Já existe estrutura de subagents (CTO Primo Rico + 11 specialists do projeto em `.claude/agents/` + 6 globais em `~/.claude/agents/`). Subagents só carregam em sessão nova; usar `Agent` com `general-purpose` se precisar paralelizar

## 1. Onde está o snapshot completo

Antes de qualquer trabalho, leia:

- **`docs/implementation/PLATFORM_SNAPSHOT.md`** — estado completo da plataforma (stack, schema, endpoints, fluxos, padrões). Ponto de partida obrigatório
- **`docs/implementation/api-catalog.md`** — todos os endpoints com status (🟢 implementado, 🟡 planejado)
- **`docs/implementation/schema-evolution.md`** — schema Prisma atual + planejado por fase
- **`docs/implementation/coding-standards.md`** — convenções (naming, padrões CRUD, migrations sem BOM, etc.)
- **`docs/implementation/glossary.md`** — termos do negócio ↔ modelos técnicos
- **`docs/implementation/adr/ADR-001-object-storage-for-images.md`** — análise de Cloudflare R2 vs alternativas (decisão tomada)

## 2. PRs entregues nesta sessão (ordem cronológica)

| PR | Tema | Status |
|---|---|---|
| [#1](https://github.com/eduardushenrique-create/BED-Site/pull/1) | Migration deploy no Railway | ✅ |
| [#2](https://github.com/eduardushenrique-create/BED-Site/pull/2) | Migration deploy no start (não build) | ✅ |
| [#3](https://github.com/eduardushenrique-create/BED-Site/pull/3) | Fix BOM da init migration | ✅ |
| [#4](https://github.com/eduardushenrique-create/BED-Site/pull/4) | Banner: render title + imageUrl do banco | ✅ |
| [#5](https://github.com/eduardushenrique-create/BED-Site/pull/5) | Banner carousel full-bleed + container 1920px | ✅ |
| [#6](https://github.com/eduardushenrique-create/BED-Site/pull/6) | Plano de implementação (5 fases) em `docs/` | ✅ |
| [#7](https://github.com/eduardushenrique-create/BED-Site/pull/7) | Conta cliente MVP (login OTP+senha+Google, /minha-conta, /meus-pedidos, endereços salvos) | ✅ |
| [#8](https://github.com/eduardushenrique-create/BED-Site/pull/8) | `PLATFORM_SNAPSHOT.md` para uso com ChatGPT | ✅ |
| [#9](https://github.com/eduardushenrique-create/BED-Site/pull/9) | Compressão de imagem + SafeImage + edição em massa de produtos | ✅ |
| [#10](https://github.com/eduardushenrique-create/BED-Site/pull/10) | Galeria multi-imagem por produto | ✅ |
| [#11](https://github.com/eduardushenrique-create/BED-Site/pull/11) | Quick wins: MP back_urls + busca header + webhook MP fail-closed | ✅ |
| [#12](https://github.com/eduardushenrique-create/BED-Site/pull/12) | Módulo de controle de produção (ProductionTask/Log/Settings) | ✅ |
| [#13](https://github.com/eduardushenrique-create/BED-Site/pull/13) | Cupons no checkout + rate limit em auth (verify-code, password-login) | ✅ |
| [#14](https://github.com/eduardushenrique-create/BED-Site/pull/14) | Sentry observability (DSN-opcional) + ADR-001 object storage | ✅ |
| [#15](https://github.com/eduardushenrique-create/BED-Site/pull/15) | Cloudflare R2 storage com fallback inline + `productionMinutesPerUnit` na API | ✅ |
| [#16](https://github.com/eduardushenrique-create/BED-Site/pull/16) | Variações de produto com estoque e imagens próprias | ✅ |

## 3. ⚠️ Pendências do stakeholder (configuração externa)

Estes itens estão **implementados no código mas inativos** até o stakeholder configurar:

### Mercado Pago — ativar webhook secret
- Variable `MERCADOPAGO_WEBHOOK_SECRET` precisa estar setada em produção (Railway)
- Sem ela, webhook responde 503 (PR #11 fail-closed). Configurar no painel MP.
- Já está com credenciais de TESTE (visto na sessão).

### Sentry (opcional, para observability)
- Roteiro: `docs/implementation/setup-sentry.md`
- Criar conta em sentry.io (free tier), copiar DSN, setar `NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_DSN` no Railway, redeploy
- Validar com `GET /api/admin/sentry-test?type=error` logado como admin

### Cloudflare R2 (opcional, para escalabilidade de imagens)
- Roteiro: `docs/implementation/setup-r2.md`
- Criar conta Cloudflare, criar bucket, gerar API token, setar 5 envs no Railway
- Sem credenciais → app continua salvando imagens como base64 inline (zero regressão)
- Após ativar, rodar `POST /api/admin/migrate-images` para mover imagens antigas

## 4. 🐛 Bugs reportados pelo stakeholder na última sessão (NÃO corrigidos)

### BUG-1 — Botão de favorito (coração) no `ProductCard` é decorativo
- **Arquivo:** `components/ProductCard.tsx:118-142` — botão tem `aria-label="Adicionar aos favoritos"` mas o `onClick` só faz `e.preventDefault()`
- **Causa:** Wishlist está planejada mas nunca foi implementada. O modelo `Wishlist` não existe ainda no schema
- **Solução proposta:** implementar Fase 3 (busca já feita) — modelo `Wishlist`, endpoints `/api/me/wishlist`, integrar no botão (não logado → redirecionar para login com next param; logado → toggle favorito)
- **Esforço:** Médio (~2-3h)

### BUG-2 — Pedido não redireciona para Mercado Pago
- **Sintoma:** stakeholder fez pedido teste, esperava ir pra tela do MP para pagar com cartão; não foi
- **Provável causa:** o `paymentMethod` selecionado no checkout pode estar como `pix` por default. Verificar `app/checkout/page.tsx:55` — `paymentMethod = useState('pix')`. Se cliente quer cartão, precisa selecionar
- **OU:** se foi cartão e mesmo assim não redirecionou, problema é em `lib/payment.ts` — `createPaymentForOrder` com cartão chama `createPaymentPreference`. Verificar:
  - Se `MERCADOPAGO_ACCESS_TOKEN` está com credenciais válidas em prod
  - Se `data.payment.checkoutUrl` está vindo na response do POST `/api/orders`
  - Se o `app/checkout/page.tsx` (handleSubmit) trata o redirect com `window.location.href = data.payment.checkoutUrl`
- **Verificação rápida:** abrir DevTools no checkout, fazer pedido cartão, ver response do POST `/api/orders` na aba Network
- **Esforço:** Baixo se for config; Médio se for bug
- **Logs**: depois do PR #14 (Sentry), erros vão pra `console.error` + Sentry. Verificar logs do Railway

### BUG-3 — Página de detalhe de pedido (admin) com erro
- **Sintoma:** stakeholder vê pedido na lista admin, clica em ver detalhes, página dá erro
- **Status:** página `app/admin/pedidos/[id]/page.tsx` EXISTE mas:
  - Faz `fetch('/api/pedidos')` (lista todos os pedidos) e procura por id no client — ineficiente
  - `fulfillmentStatuses` ainda está com `'production'` em vez de `'in_production'` (mesmo bug do PR #12 que foi corrigido só em `app/admin/pedidos/page.tsx`, não em `/[id]/page.tsx`)
  - Provavelmente o erro é o uso de `production` em algum lugar OU o tipo `Order` local não tem alguns campos novos (`discountTotal`, `couponCode`, etc.)
- **Solução:** criar endpoint `GET /api/pedidos/[id]` (ou usar `/api/orders/[orderNumber]` admin-aware), atualizar a página para fazer fetch direto, alinhar status enums
- **Esforço:** Baixo-Médio (~2h)

### BUG-4 — Cliente em `/meus-pedidos/[orderNumber]` (provavelmente OK)
- A página existe e foi criada no PR #7. Se também der erro, verificar se o problema é só no `/admin/pedidos/[id]`

## 5. 📋 Backlog priorizado para próxima sessão

### 🔥 Críticos (bugs reportados)
| # | Item | Esforço | Detalhe acima |
|---|---|---|---|
| 1 | **BUG-3** página detalhe pedido admin | Baixo-Médio | seção 4 |
| 2 | **BUG-2** redirect cartão pro MP | Baixo-Médio | seção 4 |
| 3 | **BUG-1** botão favorito não funciona (= implementar Wishlist) | Médio | seção 4 |

### ⚡ Alta prioridade
| # | Item | Esforço |
|---|---|---|
| 4 | Webhook Melhor Envio (tracking automático) | Médio |
| 5 | Esqueci minha senha (admin, com `PasswordResetToken`) | Médio |
| 6 | Refund flow MP integrado (admin pode reembolsar pedido) | Médio |

### 🎯 Média
| # | Item | Esforço |
|---|---|---|
| 7 | Migrar `<SafeImage>` → `next/image` (depois R2 ativo) | Baixo |
| 8 | Dashboard KPIs admin (vendas hoje/mês, ticket médio, top produtos) | Médio |
| 9 | Drill-down de cliente no admin (`/admin/clientes/[id]`) | Médio |
| 10 | Banner LGPD + tela de excluir conta + exportar dados | Médio |
| 11 | Edição em lote da página de pedidos (filtros avançados, exportar CSV) | Médio |
| 12 | E-mails de mudança de status (pago → em produção → enviado → entregue) | Baixo |
| 13 | Cancelamento de pedido pelo cliente (quando ainda `pending_payment`) | Baixo |

### 🔵 Baixa
| # | Item | Esforço |
|---|---|---|
| 14 | Reviews/avaliações de produtos | Alto |
| 15 | Auditoria admin (`AuditLog` para mudanças sensíveis) | Médio |
| 16 | Refazer Pix expirado (regenerar com novo QR) | Baixo |
| 17 | Notificações "avise quando voltar" para produtos sem estoque | Baixo |
| 18 | CRUD de impressoras + fila por máquina (evolução de produção) | Alto |
| 19 | CI/CD com lint+typecheck+Playwright antes do merge | Médio |

### 🧹 Dívidas técnicas conhecidas
- 2 erros pré-existentes em `tests/e2e.spec.ts` (Playwright, linhas 26 e 34)
- 1 erro pré-existente em `app/api/orders/[orderNumber]/route.ts:8` (`RouteContext` não tipado)
- `console.error` em `lib/database.ts` ainda não migrados para `captureException` (escopo grande, fazer aos poucos)
- `lib/auth-codes.ts:assertRateLimit` está marcado `@deprecated` mas ainda no arquivo
- `lib/supabase.ts` é legado — pode ser removido
- Modelos `Cart`/`CartItem` no schema não são usados (carrinho vive em React Context)
- Lint debt: alguns `react-hooks/set-state-in-effect` em `useEffect` síncronos

## 6. Subagents disponíveis (já criados)

### Globais (em `~/.claude/agents/`)
- `cto-primo-rico` — orquestrador genérico (este foi quem coordenou tudo)
- `dev-frontend` — UI React/Next
- `dev-backend` — API/DB/integrações
- `qa-tester` — validação
- `arquiteto` — decisões técnicas (escreve ADRs)
- `security-architect` — auditoria de segurança

### Específicos do projeto (em `.claude/agents/`)
- `bed-production-cto` — orquestrador específico do módulo de produção
- `bed-schema-migration-engineer` — Prisma + migrations sem BOM
- `bed-production-domain-engineer` — lógica `lib/production.ts`
- `bed-database-service-engineer` — `lib/database.ts` + fallback localDb
- `bed-api-engineer` — Route Handlers
- `bed-admin-ui-engineer` — UI admin
- `bed-customer-ui-engineer` — UI cliente
- `bed-payment-webhook-integration-engineer` — integração MP/webhook
- `bed-security-reviewer` — auditoria
- `bed-qa-test-engineer` — QA
- `bed-code-reviewer` — revisão final
- `bed-docs-handoff-writer` — handoff

> **Importante:** os agents só são reconhecidos via `subagent_type` em sessões NOVAS (após criar os arquivos). Em sessão atual, use `Agent` com `general-purpose` e prompt customizado.

## 7. Padrões consolidados (não reabrir)

1. **Container global em 1920px** (estilo KaBuM)
2. **Estilização inline** (`style={{}}`), sem Tailwind ativo
3. **Rotas admin em PT-BR** (`/api/produtos`), **públicas em EN** (`/api/products`), **cliente em** `/api/me/*`
4. **Migrations rodam no `start`** (não no build) — Railway pode não ter rede para o DB no build
5. **NUNCA migration com BOM** (`head -c 3 ... | xxd` deve mostrar `2d2d 20`, não `efbb bf`)
6. **Fallback localDb obrigatório** em todas as funções de `lib/database.ts`
7. **OTP cria conta automaticamente**, mas tem aba "Criar conta" com nome+telefone para enriquecer
8. **Webhook MP rejeita 503 sem secret** (fail-closed)
9. **Server SEMPRE revalida** preço/cupom/estoque/variação no `POST /api/orders`
10. **Cliente NUNCA recebe** `notes`/`priority`/`risk.reason`/`createdByEmail` — `serializeCustomerProduction` cuida
11. **Storage adapter** (`lib/storage`): R2 se 5 envs setadas, senão InlineStorage (data URL)
12. **`productionMinutesPerUnit`** persistido na API de produtos (TODO removido)

## 8. Variáveis de ambiente — estado atual

```env
# Database (Railway Postgres)
DATABASE_URL=...                           # ✅ configurado

# Mercado Pago — TESTE (alternar para produção quando estiver pronto)
PAYMENT_PROVIDER=mercadopago               # ✅ setado
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...       # ✅ teste
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=...     # ✅ teste
MERCADOPAGO_WEBHOOK_SECRET=                # ⚠️ verificar — sem ela webhook responde 503

# App
NEXT_PUBLIC_APP_URL=                       # ⚠️ verificar — sem ela back_urls do MP é omitido
NEXT_PUBLIC_STORE_ORIGIN_ZIP=01001000      # ✅

# Resend (e-mail)
RESEND_API_KEY=                            # ⚠️ verificar

# Melhor Envio
MELHOR_ENVIO_TOKEN=                        # ⚠️ verificar
MELHOR_ENVIO_SECRET=                       # ⚠️ verificar

# Admin gating
OWNER_EMAILS=                              # ⚠️ verificar
ADMIN_EMAILS=eduardus.henrique@gmail.com   # ⚠️ verificar

# Sentry (opcional — sem DSN, observability fica off)
NEXT_PUBLIC_SENTRY_DSN=                    # ❌ não configurado
SENTRY_DSN=                                # ❌
SENTRY_AUTH_TOKEN=                         # ❌

# Cloudflare R2 (opcional — sem essas, imagens ficam inline base64)
R2_ACCOUNT_ID=                             # ❌
R2_ACCESS_KEY_ID=                          # ❌
R2_SECRET_ACCESS_KEY=                      # ❌
R2_BUCKET_NAME=                            # ❌
R2_PUBLIC_URL=                             # ❌
```

## 9. Comandos úteis

```bash
# Sincronizar com main no início da sessão
git fetch origin main && git reset --hard origin/main

# Validar antes de qualquer commit
npx prisma generate
npx tsc --noEmit                          # ignorar 2 erros pré-existentes
npx next build                            # tem que passar

# Antes de criar migration
head -c 3 prisma/migrations/<nova>/migration.sql | xxd  # deve ser 2d2d 20

# Criar PR + merge
gh pr create --base main --head <branch> --title "..." --body "..."
gh pr merge <num> --squash --delete-branch=false
```

## 10. Como começar a próxima sessão (checklist)

1. **Ler `docs/implementation/HANDOFF.md`** (este arquivo)
2. **Ler `docs/implementation/PLATFORM_SNAPSHOT.md`** para contexto da plataforma
3. **`git fetch origin main && git reset --hard origin/main`** para sincronizar
4. **`gh pr list --state merged --limit 5`** para confirmar últimos merges
5. **Verificar logs do Railway** se houve erros nos últimos deploys
6. **Confirmar com o stakeholder** qual bug/feature priorizar primeiro
7. **Atacar BUGs primeiro** (seção 4) — são bloqueadores funcionais

## 11. Mensagem inicial recomendada para o Claude da nova sessão

```
Você é o CTO Primo Rico do projeto BED Design.

Leia (nesta ordem) e me dê um resumo do estado atual:
1. docs/implementation/HANDOFF.md (este arquivo, completo)
2. docs/implementation/PLATFORM_SNAPSHOT.md
3. git log --oneline -10

Depois, me proponha plano para atacar os 3 bugs reportados na seção 4
do HANDOFF (página detalhe pedido admin, redirect MP, botão favorito).
Não comece a codar antes do meu OK no plano.
```

---

**Fim do handoff.** Próxima sessão tem tudo que precisa para continuar sem perder contexto.
