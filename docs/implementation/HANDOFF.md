# Handoff — Sessão BED Design

> **Como usar este documento:** abra uma nova sessão do Claude Code no diretório `C:\PROJETOS\BED-Site` e cole o conteúdo abaixo na primeira mensagem (ou referencie o arquivo `docs/implementation/HANDOFF.md`). O assistente terá contexto completo para continuar de onde paramos.
>
> **Última atualização:** 2026-05-16 — Varredura de legado + 7 PRs de limpeza (#178–#184). Dívidas técnicas verificadas no código real (ver seção "Dívidas técnicas" abaixo).

---

## 0-bis. Atividade recente (2026-05-13 → 2026-05-14)

**Ciclo SPEC-005 — Edição/Exclusão na Produção + Pagamentos Parciais — ✅ ENTREGUE.**

Spec completa em [`spec/SPEC-005-edicao-producao-pagamentos-parciais.md`](spec/SPEC-005-edicao-producao-pagamentos-parciais.md) (status detalhado na §0 do próprio doc).

| Fase | PRs | Resumo |
|---|---|---|
| Infra de migration (gates ADR-003 v2) | [#146](https://github.com/eduardushenrique-create/BED-Site/pull/146) [#147](https://github.com/eduardushenrique-create/BED-Site/pull/147) [#148](https://github.com/eduardushenrique-create/BED-Site/pull/148) [#149](https://github.com/eduardushenrique-create/BED-Site/pull/149) [#152](https://github.com/eduardushenrique-create/BED-Site/pull/152) [#155](https://github.com/eduardushenrique-create/BED-Site/pull/155) | GitHub Action que aplica migrations, `start.mjs` valida `_prisma_migrations` direto via `pg`, boot smoke no CI, forbidden-patterns CI, REQUIRED_ORDER_COLUMNS no health |
| Fase 1 — Schema | [#156](https://github.com/eduardushenrique-create/BED-Site/pull/156) | `PaymentInstallment`, `Order.paidAmount/dueAmount/createdVia/refundStatus`, `OrderItem.deletedAt` |
| Fase 2a — Backend installments CRUD | [#157](https://github.com/eduardushenrique-create/BED-Site/pull/157) | `lib/installments.ts` + `/api/pedidos/[id]/installments[/[id]]` com lock pessimista |
| Fase 2b — Backend DELETE produção 3 modos | [#158](https://github.com/eduardushenrique-create/BED-Site/pull/158) | TASK_ONLY / ITEM_ONLY / ORDER, soft-delete sincronizado, reason obrigatório |
| Fase 3a — Admin UI | [#159](https://github.com/eduardushenrique-create/BED-Site/pull/159) | Seção "Pagamentos" + modal + zona de perigo de exclusão |
| Fase 3b — Cliente UI + isolamento | [#160](https://github.com/eduardushenrique-create/BED-Site/pull/160) | Pedidos `createdVia='admin'` invisíveis em `/minha-conta` e silenciosos em email |
| Polish — Alinhamento visual | [#161](https://github.com/eduardushenrique-create/BED-Site/pull/161) | `OrderPaymentsSection` + `RegisterInstallmentModal` reescritas no tema admin claro, scroll horizontal removido em `/admin/pedidos` e `/admin/auditoria` |

**Cortado para SPEC-006 futura:** refund automático via API do Mercado Pago (volume zero justifica risco baixo de adiar).

**Lições mecanizadas em CI/docs nesta sessão:**
1. Tema admin é claro inline — não importar Tailwind dark (`zinc-*`, `emerald-*`). Documentado em [`coding-standards.md` §Design tokens do admin](coding-standards.md#design-tokens-do-admin-tema-claro).
2. `minWidth` fixo grande em tabela força scroll lateral mesmo em viewport ampla. Preferir truncar célula variável (ellipsis + `title=`).
3. `DATABASE_URL_PRODUCTION` em GitHub Action precisa URL pública (`*.proxy.rlwy.net`), não interna `postgres.railway.internal`.
4. Migration `rolled_back` no Postgres do Railway é informativo, NÃO é erro — boot não deve abortar.

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
| [#17](https://github.com/eduardushenrique-create/BED-Site/pull/17) | docs: HANDOFF.md inicial | ✅ |
| [#18](https://github.com/eduardushenrique-create/BED-Site/pull/18) | **BUG-3** Página detalhe pedido admin (endpoint dedicado + enums alinhados) | ✅ |
| [#19](https://github.com/eduardushenrique-create/BED-Site/pull/19) | **BUG-2** Redirect cartão MP (instrumentação + UX + 502 quando sem checkoutUrl) | ✅ |
| [#20](https://github.com/eduardushenrique-create/BED-Site/pull/20) | **BUG-1** Wishlist (modelo + API + ProductCard + /minha-conta/favoritos) | ✅ |
| [#21](https://github.com/eduardushenrique-create/BED-Site/pull/21) | Esqueci minha senha (PasswordResetToken + email + /login/redefinir-senha) | ✅ |
| [#22](https://github.com/eduardushenrique-create/BED-Site/pull/22) | Webhook Melhor Envio (HMAC + tracking automático + emails) | ✅ |
| [#23](https://github.com/eduardushenrique-create/BED-Site/pull/23) | Refund flow MP integrado no admin | ✅ |
| [#24](https://github.com/eduardushenrique-create/BED-Site/pull/24) | Dashboard KPIs admin (vendas hoje/mês, ticket, top produto) | ✅ |
| [#25](https://github.com/eduardushenrique-create/BED-Site/pull/25) | Drill-down cliente `/admin/clientes/[id]` (single fetch + totais) | ✅ |
| [#26](https://github.com/eduardushenrique-create/BED-Site/pull/26) | E-mails de mudança de status (notifyOrderStatusChange) | ✅ |
| [#27](https://github.com/eduardushenrique-create/BED-Site/pull/27) | Cancelamento de pedido pelo cliente (pending only) | ✅ |
| [#28](https://github.com/eduardushenrique-create/BED-Site/pull/28) | Refazer Pix expirado (POST /api/me/orders/[orderNumber]/regenerate-pix) | ✅ |
| [#29](https://github.com/eduardushenrique-create/BED-Site/pull/29) | Filtros avançados de pedidos + export CSV | ✅ |
| [#30](https://github.com/eduardushenrique-create/BED-Site/pull/30) | LGPD: banner cookies + export dados + excluir conta (anonimização) | ✅ |
| [#31](https://github.com/eduardushenrique-create/BED-Site/pull/31) | Atualização de docs (HANDOFF + SNAPSHOT + api-catalog + schema-evolution) | ✅ |
| [#32](https://github.com/eduardushenrique-create/BED-Site/pull/32) | UX/responsividade: 12 fixes da auditoria 02/05/2026 (header mobile, produto, touch targets, etc.) | ✅ |
| [#33](https://github.com/eduardushenrique-create/BED-Site/pull/33) | WhatsApp real (11) 97887-1566 + Instagram @beddesings | ✅ |
| [#34](https://github.com/eduardushenrique-create/BED-Site/pull/34) | "Avise quando voltar" para produtos sem estoque (RestockAlert + email) | ✅ |
| [#35](https://github.com/eduardushenrique-create/BED-Site/pull/35) | AuditLog admin (refund/update/delete pedidos, cupons CRUD, exclusão LGPD) + tela `/admin/auditoria` | ✅ |
| [#36](https://github.com/eduardushenrique-create/BED-Site/pull/36) | CI/CD GitHub Actions (lint + typecheck + build + migration BOM check) | ✅ |
| [#37](https://github.com/eduardushenrique-create/BED-Site/pull/37) | docs: refresh pós-PRs #34-#36 | ✅ |
| [#38](https://github.com/eduardushenrique-create/BED-Site/pull/38) | fix: RouteContext (CI typecheck) | ✅ |
| [#39](https://github.com/eduardushenrique-create/BED-Site/pull/39) | feat: avaliações de produto com moderação admin (Review + estrelas) | ✅ |
| [#40](https://github.com/eduardushenrique-create/BED-Site/pull/40) | feat: CRUD de impressoras + atribuição de tarefas (Printer + ProductionTask.printerId) | ✅ |
| [#41](https://github.com/eduardushenrique-create/BED-Site/pull/41) | docs: refresh pós-#39 + #40 | ✅ |
| [#42](https://github.com/eduardushenrique-create/BED-Site/pull/42) | feat(seo): JSON-LD Product + OpenGraph/Twitter cards | ✅ |
| [#43](https://github.com/eduardushenrique-create/BED-Site/pull/43) | feat(production): Kanban-style board agrupado por impressora | ✅ |
| [#44](https://github.com/eduardushenrique-create/BED-Site/pull/44) | feat(home): seção de reviews aprovadas em destaque | ✅ |
| [#45](https://github.com/eduardushenrique-create/BED-Site/pull/45) | feat(security): Captcha Turnstile (DSN-opcional) | ✅ |
| [#46](https://github.com/eduardushenrique-create/BED-Site/pull/46) | feat(observability): logs estruturados (pino) com redact | ✅ |
| [#47](https://github.com/eduardushenrique-create/BED-Site/pull/47) | feat(rate-limit): Upstash Redis (opcional, fallback Postgres+memory) | ✅ |
| [#48](https://github.com/eduardushenrique-create/BED-Site/pull/48) | fix(admin+login): sidebar Painel + uniformiza largura do login (640px) | ✅ |
| *(SPEC-007 — sessão 2026-05-15)* | | |
| [#170](https://github.com/eduardushenrique-create/BED-Site/pull/170) | feat(db): SPEC-007 PR-1 schema + migration consolidada | ✅ |
| [#171](https://github.com/eduardushenrique-create/BED-Site/pull/171) | fix(types): guard productId=null em BOM/estoque pós-SPEC-007 PR-1 | ✅ |
| [#172](https://github.com/eduardushenrique-create/BED-Site/pull/172) | feat(api): SPEC-007 PR-2a calculadora de preço + endpoints de orçamento | ✅ |
| [#173](https://github.com/eduardushenrique-create/BED-Site/pull/173) | feat(api): SPEC-007 PR-2b pedido manual + ponte orçamento→pedido | ✅ |
| [#174](https://github.com/eduardushenrique-create/BED-Site/pull/174) | feat(ui): SPEC-007 PR-3a3 tela de configurações de precificação | ✅ |
| [#175](https://github.com/eduardushenrique-create/BED-Site/pull/175) | feat(ui): SPEC-007 PR-3a1 UI calculadora de orçamentos /admin/orcamentos | ✅ |
| [#176](https://github.com/eduardushenrique-create/BED-Site/pull/176) | fix(orcamentos): parser dos lookups aceita shape real de cada API | ✅ |
| [#177](https://github.com/eduardushenrique-create/BED-Site/pull/177) | fix(orcamentos): server component carrega estimate direto do Prisma | ✅ |
| *(Limpeza de legado — sessão 2026-05-16)* | | |
| [#178](https://github.com/eduardushenrique-create/BED-Site/pull/178) | fix(security): renomeia proxy.ts → middleware.ts para ativar guard de /admin | ✅ |
| [#179](https://github.com/eduardushenrique-create/BED-Site/pull/179) | chore(cleanup): remove ShippingSelector.tsx (componente não usado) | ✅ |
| [#180](https://github.com/eduardushenrique-create/BED-Site/pull/180) | docs(env): adiciona BLOB_READ_WRITE_TOKEN ao .env.example | ✅ |
| [#181](https://github.com/eduardushenrique-create/BED-Site/pull/181) | chore(observability): padroniza logs de erro com captureException + logger em 14 arquivos | ✅ |
| [#182](https://github.com/eduardushenrique-create/BED-Site/pull/182) | fix(lint): remove react-hooks/set-state-in-effect nos banners (useMemo) | ✅ |
| [#183](https://github.com/eduardushenrique-create/BED-Site/pull/183) | docs(cleanup): remove HANDOFF-SPEC-007 e entradas Cart/CartItem obsoletas de schema-evolution | ✅ |
| [#184](https://github.com/eduardushenrique-create/BED-Site/pull/184) | chore(cleanup): remove docs de processo órfãos da raiz (erros.md, SKILL.md, SPEC.md, TEST_PLAN.md) | ✅ |

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

## 3-bis. Release process & Rollback

Adotado a partir de 2026-05-14 (Onda 1 do plano SPEC-007). Decisão completa em [ADR-004](adr/ADR-004-staging-environment.md).

### Como liberar uma mudança em produção

1. **Trabalho em branch de feature** (ex: `feat/nova-feature`). Commits + push.
2. **PR pra `main`** → CI verde (Lint+Typecheck+Build, boot smoke, Prisma smoke) → merge.
3. **Auto-deploy em staging:** Railway staging detecta push em `main` e faz deploy.
4. **`migrate-staging.yml`** roda automaticamente — aplica migrations no Postgres staging.
5. **Smoke Playwright** roda em seguida — vive como job do próprio `migrate-staging.yml` (não em workflow separado, vide ADR-004 atualização 2026-05-14). 3 testes contra `https://bed-site-staging.up.railway.app`:
   - GET `/` retorna 200 com título correto
   - GET `/api/health` retorna `status=ok` com 4 checks up
   - GET `/admin` retorna < 500
6. **QA manual** (opcional, recomendado para mudanças visuais): abrir `https://bed-site-staging.up.railway.app`, navegar pelo fluxo afetado. Smoke não detecta regressão visual — humano precisa olhar.
7. **Promover para prd:** Actions → **Promote staging → prd** → Run workflow:
   - `commit_sha`: vazio (usa HEAD de main) ou SHA específico
   - `reason`: obrigatório, ex: `"release SPEC-007 fase 1"`
   - Click "Run"
8. **Promote valida, cria tag e atualiza `production`:**
   - Confere que smoke ficou verde naquele commit (gate de release)
   - Calcula próxima tag `vYYYY.MM.DD-N`, cria tag anotada com motivo
   - Faz `git push --force-with-lease` na branch `production` apontando pro SHA
9. **Dois efeitos automáticos:**
   - **Tag** dispara `migrate-prd.yml` → aplica migrations em prd-db
   - **Branch `production`** dispara deploy do Railway prd (Railway escuta essa branch — reconfiguração manual prévia, vide [ADR-004 §Ações manuais](adr/ADR-004-staging-environment.md))

### Como fazer rollback

| Situação | Caminho |
|---|---|
| **PR ruim já mergeado em main, ainda não promovido** | `git revert <sha>` na main + nova PR + smoke verde + Promote novamente. Prd não foi afetado. |
| **Promote subiu commit com bug em prd** | Caminho mais rápido: Railway prd → **Deployments** → encontrar deploy anterior → **Redeploy**. Em paralelo, alguém faz `git push --force-with-lease origin <sha-bom>:production` apontando pro commit anterior, para o HEAD de `production` voltar a refletir o que está em prd. Migration de prd permanece aplicada (Prisma migrations não voltam sozinhas — apenas o código volta). |
| **Migration aplicada em prd é destrutiva** | Ação manual: `npx prisma migrate resolve --rolled-back <migration_name>` apontando para o Postgres prd, **só depois de aprovação explícita**. NUNCA apagar linha de `_prisma_migrations` direto no SQL. |
| **Schema mudou e Prisma client espera coluna que não existe** | Sintoma é health 503 com `missingColumns`. Aplicar migration pendente via `migrate-prd.yml` (workflow_dispatch). Se a migration em si está errada, criar nova migration corretiva — não editar a falha. |

### Comandos úteis (referência)

```bash
# Disparar smoke manualmente (sem novo commit; default ref=main)
gh workflow run smoke-staging.yml
# Ou testar um SHA/tag/branch especifico:
gh workflow run smoke-staging.yml -f ref=<sha|tag|branch>

# Promover head de main (atalho via CLI)
gh workflow run promote.yml -f reason="motivo aqui"

# Promover SHA específico
gh workflow run promote.yml -f commit_sha=<sha> -f reason="motivo"

# Ver o que esta rodando em prd agora
git fetch origin production
git log origin/production --oneline -5

# Listar tags do dia (para conferir N atual)
git tag --list "v$(date -u +%Y.%m.%d)-*"
```

### ⚠️ Pendência operacional (uma vez só)

Após o `promote.yml` passar a empurrar pra branch `production` (já está em código), **reconfigurar Railway prd para escutar a branch `production` em vez de `main`**. Sem isso, prd continua subindo todo push em main e o gate de smoke é ignorado.

Caminho: painel Railway → projeto **BED-Site** (produção) → Service → **Settings** → **Source** (ou **Service Source**) → mudar branch de `main` para `production` → Salvar. Stakeholder faz isso manualmente uma vez só.

(Tag `v*` não pode ser usada como trigger no Railway — limitação documentada da Railway, vide ADR-004 §Decisão item 2.)

---

## 4. 🐛 Bugs reportados pelo stakeholder — TODOS RESOLVIDOS ✅

| Bug | PR | Resumo |
|---|---|---|
| BUG-1 — Botão de favorito decorativo | [#20](https://github.com/eduardushenrique-create/BED-Site/pull/20) | Wishlist completa: modelo, API `/api/me/wishlist`, integração no `ProductCard` com redirect pra login se não-logado, página `/minha-conta/favoritos` |
| BUG-2 — Cartão não redireciona pro MP | [#19](https://github.com/eduardushenrique-create/BED-Site/pull/19) | (1) Default paymentMethod removido (era 'pix'), (2) instrumentação `captureMessage` no `lib/payment.ts` e `lib/mercadopago.ts` para descobrir causa real em prod, (3) `/api/orders` retorna **502 com mensagem clara** quando method=card e MP não devolveu URL — não silencia mais o erro |
| BUG-3 — Página detalhe pedido admin | [#18](https://github.com/eduardushenrique-create/BED-Site/pull/18) | Novo `GET /api/pedidos/[id]`, single fetch, enums alinhados (`production`→`in_production`, `failed`→`rejected`), exibição de desconto/cupom |

## 5. 📋 Backlog atualizado

### ✅ Entregues nesta sessão
- BUG-1, BUG-2, BUG-3 (3 bugs reportados pelo stakeholder)
- Item #4 — Webhook Melhor Envio
- Item #5 — Esqueci minha senha
- Item #6 — Refund flow MP integrado
- Item #8 — Dashboard KPIs admin
- Item #9 — Drill-down cliente
- Item #10 — LGPD (banner + export + delete)
- Item #11 — Filtros avançados + CSV
- Item #12 — E-mails de mudança de status
- Item #13 — Cancelamento de pedido pelo cliente
- Item #15 — Auditoria admin (AuditLog)
- Item #16 — Refazer Pix expirado
- Item #17 — Avise quando voltar (RestockAlert)
- Item #19 — CI/CD GitHub Actions
- Item #14 — Reviews de produto com moderação
- Item #18 — CRUD de impressoras + atribuição de tarefas
- 12/15 fixes da auditoria de UX/responsividade
- Configuração de WhatsApp e Instagram reais
- SEO estruturado (JSON-LD Product + OG/Twitter)
- Visão Kanban de produção por impressora
- Reviews em destaque na home
- Captcha Turnstile DSN-opcional
- Logs estruturados (pino) com redact de secrets
- Rate limit Upstash Redis DSN-opcional
- Sidebar admin com Painel + uniformização do login

### ⏳ Pendentes (precisam de configuração externa do stakeholder antes)
| # | Item | Bloqueio |
|---|---|---|
| 7 | Migrar `<SafeImage>` → `next/image` | Depende do R2 ativo (5 envs no Railway) |
| — | Acentuação correta nos produtos (Descrição/produção/úteis) | Edição manual via `/admin/produtos` |
| — | Captcha Turnstile (PR #45) | Setar `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` no Railway |
| — | Rate limit em Redis (PR #47) | Setar `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` no Railway |

### 🎯 Backlog futuro

**Pedidos do stakeholder em 02/05/2026 (durante onboarding das envs):**

- **CRUD de templates de email no admin** — gerenciar `/admin/emails/templates` em vez de editar código a cada ajuste de copy. Escopo: novo modelo `EmailTemplate { id, slug, subject, htmlBody, textBody?, variables (Json), updatedAt }`, página admin com editor (textarea ou rich-text simples), helper que busca template por slug e renderiza com variáveis, override de templates do `lib/email.ts` (envio em-stock-back, password-reset, order-* etc.). Mantém os defaults hardcoded como fallback se admin não criou template ainda. Esforço: Médio (~1 dia).

- **Disparo em massa de promoções** — `/admin/emails/campanha`. Admin escolhe segmento (todos cadastrados, com pedido pago nos últimos 60 dias, top-spenders, com wishlist ativa, etc.), seleciona ou escreve template, agenda ou dispara. Escopo: novo `EmailCampaign { id, name, segment Json, templateId|content, scheduledAt?, sentAt?, recipientCount }` + endpoint de preview de segmento + dispatcher em background (queue) + tracking de bounce/unsubscribe via Resend webhooks. Conformidade LGPD: link de "descadastrar" obrigatório no rodapé, modelo `EmailUnsubscribe` para opt-outs. Esforço: Alto (~2 dias).

Outros futuros:

### 📦 Controle de estoque de componentes (SPEC-001) — ENTREGUE em 5 fases
- **Spec completa:** [`docs/implementation/spec/SPEC-001-components-stock-control.md`](spec/SPEC-001-components-stock-control.md)
- **Fase 1** (PR #72) — CRUD `Component` + `StockMovement` + `AlertSettings` + tela `/admin/componentes` + tela `/admin/configuracoes/alertas`
- **Fase 2** (PR #74) — modelo `ProductComponent` (BOM) + tela "Componentes deste produto" no editor de produto
- **Fase 3** (PR #76) — hook em `updateProductionTask` que debita estoque atomicamente conforme `quantityDelta`; card "Materiais necessários" no detalhe do pedido
- **Fase 4** (PR #77) — alertas reais: e-mail `low_stock_alert` (com throttle de 6h via `LowStockAlertLog`) + e-mail `order_component_shortage` na criação de pedido + badge vermelho no menu lateral
- **Fase 5** — KPIs no `/admin/componentes` (total/em baixa/zerados/valor estimado) + export CSV de movimentações + esta seção
- **Pendência operacional do stakeholder:** cadastrar e-mails em `/admin/configuracoes/alertas` após o deploy pra alertas dispararem (sem cadastro, fallback é `RESEND_REPLY_TO_EMAIL`)

### 🧹 Dívidas técnicas — TODAS LIMPAS

> Verificado em varredura completa de código em 2026-05-16 (sessão de limpeza de legado, PRs #178–#184). Cada item abaixo foi confirmado com `grep` no código real — não apenas declarado.

- ✅ `lib/supabase.ts` + `lib/db.ts` (PR #63 + dependência npm desinstalada) — **confirmado em 2026-05-16**: arquivo inexistente, `@supabase/supabase-js` ausente do `package.json`, zero ocorrências de `supabase` em `*.ts`/`*.tsx`
- ✅ `assertRateLimitLegacy` deprecated (PR #57) — **confirmado em 2026-05-16**: zero ocorrências de `assertRateLimit` em todo o código TS/TSX
- ✅ Modelos `Cart`/`CartItem` + `DROP TABLE` em prod (PR #65) — entradas removidas de `schema-evolution.md` em PR #183
- ✅ `console.error` → `captureException` + `pino` em `lib/database.ts` (PRs #67 + #69, 71 ocorrências via helper `reportDbError`) — estendido em PR #181 para mais 14 arquivos (libs + rotas produto + rotas email-admin + rotas cupons)
- ✅ Erros pré-existentes em `tests/e2e.spec.ts` (PR #66)
- ✅ Erro `RouteContext` em `app/api/orders/[orderNumber]/route.ts` (resolvido em PR antigo)
- ✅ `proxy.ts` renomeado para `middleware.ts` + export corrigido (PR #178) — guard de `/admin` estava inativo por nome de arquivo errado
- ✅ `components/ShippingSelector.tsx` removido (PR #179) — componente sem nenhum importador
- ✅ Lint `react-hooks/set-state-in-effect` em banners (PR #182) — `useState+useEffect` derivado substituído por `useMemo`
- ✅ Docs de processo órfãos da raiz removidos (PR #184): `erros.md`, `SKILL.md`, `SPEC.md`, `TEST_PLAN.md`

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
8. **Webhook MP rejeita 503 sem secret** (fail-closed). Mesmo padrão para webhook ME (PR #22).
9. **Server SEMPRE revalida** preço/cupom/estoque/variação no `POST /api/orders`
10. **Cliente NUNCA recebe** `notes`/`priority`/`risk.reason`/`createdByEmail` — `serializeCustomerProduction` cuida
11. **Storage adapter** (`lib/storage`): R2 se 5 envs setadas, senão InlineStorage (data URL)
12. **`productionMinutesPerUnit`** persistido na API de produtos (TODO removido)
13. **`paymentStatus` enum**: `pending | paid | rejected | cancelled | refunded` (NUNCA `failed`)
14. **`fulfillmentStatus` enum**: `pending | in_production | ready_to_ship | shipped | delivered | cancelled` (NUNCA `production`)
15. **Notificações ao cliente** centralizadas em `lib/order-notifications.ts:notifyOrderStatusChange` — `PUT /api/pedidos` chama; webhook ME envia próprios emails para shipped/delivered
16. **Anonimização (LGPD)**: `anonymizeCustomer` preserva pedidos antigos para fins fiscais; substitui dados pessoais e detacha `customerId` (`SET NULL`)
17. **Wishlist** vive em `WishlistContext` mountado entre `AuthProvider` e `CartProvider` no `SiteShell`
18. **AuditLog** é write-best-effort (`recordAuditEntry` nunca propaga erro). Hooks em refund, update/delete pedidos, CRUD de cupons, exclusão LGPD
19. **Restock alerts** disparam automaticamente em `updateProduct` e `updateProductVariant` quando o produto/variação volta a ter estoque (com `notifiedAt: null` filter para idempotência)
20. **CI** roda em `tsconfig.ci.json` (exclui `tests/e2e.spec.ts`); migrations são checadas para BOM no workflow
21. **Captcha Turnstile** é DSN-opcional via `verifyTurnstileToken` em `lib/turnstile.ts`. Sem `TURNSTILE_SECRET_KEY` → skipped:true. Aplicado em login (OTP+senha), esqueci-senha e restock-alert
22. **Rate limit** prioridade: Upstash Redis (REST) → Postgres `RateLimitBucket` → memória. Cada tier degrada para o próximo em caso de erro
23. **Logger estruturado**: `createLogger({ component: 'x' })` em `lib/logger.ts`, redact automático de password/token/cookie/authorization
24. **Sidebar admin**: navItems agora incluem `Painel` (exact match) + `Impressoras`/`Avaliações`/`Auditoria` que tinham sido criadas mas não linkadas
25. **JSON-LD**: Product (com aggregateRating quando há reviews) emitido em `/produtos/[slug]`; Organization + WebSite na home

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

# Cloudflare Turnstile (opcional — sem essas, captcha fica off)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=            # ❌
TURNSTILE_SECRET_KEY=                      # ❌

# Upstash Redis (opcional — sem essas, rate-limit cai pro Postgres bucket)
UPSTASH_REDIS_REST_URL=                    # ❌
UPSTASH_REDIS_REST_TOKEN=                  # ❌

# Logger
LOG_LEVEL=                                 # default: info em prod, debug em dev
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
