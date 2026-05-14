# Handoff — SPEC-007 (Orçamentos + Pedidos Manuais) com gate de staging

> **Como usar este documento:**
>
> 1. Abra nova sessão do Claude Code em `C:\PROJETOS\BED-Site`.
> 2. Cole na primeira mensagem: _"Leia `docs/implementation/HANDOFF-SPEC-007.md` e siga o plano. Não invente nada além do escopo."_
> 3. O agente vai ler este arquivo + a SPEC + o ADR-004 (que ele mesmo vai escrever no PR-staging-E) e começar pela Onda 1.
>
> **Data deste handoff:** 2026-05-14
> **Autor:** sessão de desenho com o stakeholder (não-técnico) — Edu (eduardus.henrique@gmail.com)
> **Estado:** Onda 1 PR-staging-A em diante (Railway staging já está em pé)

---

## 0. Resumo em 30 segundos

Stakeholder pediu:
1. **Funcionalidade** — calculadora de precificação (substituir planilha Excel) + pedidos manuais avulsos (WhatsApp/Instagram/indicação) — desenhada em [`spec/SPEC-007-orcamentos-e-pedidos-manuais.md`](spec/SPEC-007-orcamentos-e-pedidos-manuais.md).
2. **Infra** — ambiente de staging entre `main` e produção, justificado pelo histórico de 5 incidentes em prd nos últimos 30 dias (PR #133, #141, #143, PR-5, PR-5b).

**Decisão tomada:** entregar **Onda 1** (infra de staging) **antes** da Onda 2 (SPEC-007). O PR-1 da SPEC só mergeia depois de staging operacional, porque a Onda 1 é o **gate operacional** que protege a Onda 2 dos próprios riscos da SPEC (mudança em `OrderItem.productId`, migration consolidada, 6 colunas novas em `Order`/`OrderItem`).

**Total estimado:** 13 PRs pequenos. 5-8 dias úteis de implementação.

---

## 1. Contexto operacional

- **Projeto:** BED Design (Forma 3D) — e-commerce de impressão 3D personalizada
- **Repositório:** https://github.com/eduardushenrique-create/BED-Site
- **Branch principal:** `main`
- **Hospedagem produção:** Railway projeto `BED-Site` (Next + Postgres). Deploy automático no merge para `main`.
- **Hospedagem staging:** Railway projeto `BED-Site-Staging` (recém-criado). URL: `https://bed-site-staging.up.railway.app`. Banco vazio, schema sincronizado (37 migrations aplicadas em 2026-05-14 via one-shot manual). **Você não precisa popular nada — admin vai criar manualmente.**
- **Stakeholder:** Edu — não-técnico. Reports em **linguagem leiga, sem jargão**. Decisões técnicas você toma; só pede confirmação quando há trade-off de produto real.
- **Subagentes disponíveis:** `dev-backend`, `dev-frontend`, `security-architect`, `qa-tester`, `arquiteto`, `cto-primo-rico`, `bed-legacy-cleaner`. Use `cto-primo-rico` para coordenar; ele distribui o backlog.

## 2. Documentos obrigatórios de leitura (nesta ordem)

1. **[`spec/SPEC-007-orcamentos-e-pedidos-manuais.md`](spec/SPEC-007-orcamentos-e-pedidos-manuais.md)** — a especificação completa da Onda 2. Já tem schema, endpoints, UI mockups, plano de 8 PRs, critérios de aceite, riscos. Não reescreva — execute.
2. **[`coding-standards.md`](coding-standards.md)** — convenções gerais + paleta admin (tema claro inline, sem Tailwind dark). Referências canônicas: `OrderPaymentsSection.tsx`, `RegisterInstallmentModal.tsx`.
3. **[`HANDOFF.md`](HANDOFF.md)** — handoff geral do projeto. Tem estado da plataforma + PRs entregues + lições mecanizadas.
4. **[`PLATFORM_SNAPSHOT.md`](PLATFORM_SNAPSHOT.md)** — snapshot completo (stack, schema, endpoints, fluxos).
5. **[`spec/SPEC-005-edicao-producao-pagamentos-parciais.md`](spec/SPEC-005-edicao-producao-pagamentos-parciais.md)** — template do estilo de SPEC que a SPEC-007 segue.
6. **[`adr/ADR-003-spec-005-safety-review.md`](adr/ADR-003-spec-005-safety-review.md)** — padrão dos gates de migration. O ADR-004 (que **você vai escrever no PR-staging-E**) segue o mesmo estilo.

---

## 3. Estado atual confirmado (não fazer de novo)

### 3.1 SPEC-007 já desenhada
- [`spec/SPEC-007-orcamentos-e-pedidos-manuais.md`](spec/SPEC-007-orcamentos-e-pedidos-manuais.md) escrita e completa.
- 4 decisões do stakeholder cristalizadas (§0): paralelo F1+F2, sem upload no MVP, margem editável em `PricingSettings`, separação Modo 1 (produto) vs Modo 2 (orçamento avulso).
- 5 decisões abertas em §8 — **resolva por defaults da §8** a menos que conflite com produto. Não pergunte ao stakeholder coisa óbvia.

### 3.2 Railway staging já configurado
- Projeto `BED-Site-Staging` criado.
- Postgres provisionado, vazio, com 37 migrations aplicadas.
- App linkado ao repo `BED-Site`, branch `main`, builder Dockerfile.
- Domínio gerado: `https://bed-site-staging.up.railway.app` — está respondendo 200 na home.
- Variáveis configuradas (raw editor):
  ```dotenv
  DATABASE_URL=${{ Postgres.DATABASE_URL }}
  NODE_ENV=production
  NEXT_PUBLIC_APP_URL=https://${{ RAILWAY_PUBLIC_DOMAIN }}
  NEXT_PUBLIC_STORE_URL=https://${{ RAILWAY_PUBLIC_DOMAIN }}
  NEXT_PUBLIC_STORE_ORIGIN_ZIP=01001000
  NEXT_PUBLIC_SHIPPING_ORIGIN_CEP=01001000
  NEXTAUTH_SECRET=<gerado, único, diferente do prd>
  NEXT_TELEMETRY_DISABLED=1
  ```
- **Demais env vars deliberadamente vazias** (MP, Resend, Sentry, R2, Google OAuth, Turnstile, Upstash). Confirmado em código que cada feature ausente degrada com fallback seguro. Não adicione nada sem pedir.

### 3.3 GitHub Secrets já cadastrados
- `DATABASE_URL_STAGING` — URL pública do Postgres staging (`*.proxy.rlwy.net`).
- `STAGING_BASE_URL` — `https://bed-site-staging.up.railway.app`.
- `DATABASE_URL_PRODUCTION` — já existia (URL pública prod).

### 3.4 Pendente — Railway prd não conhece tag triggers ainda
- Hoje Railway prd faz auto-deploy em **push em `main`**. Isso muda no PR-staging-C, junto com `migrate.yml` → `migrate-prd.yml`.
- Você precisará reconfigurar o Railway prd (Settings → Service → Triggers) para escutar **tags `v*`** em vez de pushes em main. Isso é manual no painel; documente no ADR-004 e me alerte no PR-staging-C pra eu (stakeholder) fazer.

---

## 4. Onda 1 — Infraestrutura de staging (5 PRs)

Ordem obrigatória. Cada PR é pequeno (≤ 200 linhas de código + docs).

### PR-staging-A — `migrate-staging.yml`

**O que faz:** workflow GitHub Actions que aplica migrations no banco staging em todo push pra `main`. Espelha o atual `migrate.yml`, trocando o secret.

**Arquivos:**
- Novo: `.github/workflows/migrate-staging.yml` (cópia de `migrate.yml` com `secrets.DATABASE_URL_STAGING`)

**Trigger:** `push` em `main`, mesmas exclusões de path do `migrate.yml` (docs, md, gitignore, labeler).

**Critério de aceite:**
- Roda em push pra main, verde, `prisma migrate status` mostra "up to date".
- Concurrency group separado (`db-migrations-staging`) pra não conflitar com prd.

### PR-staging-B — `smoke-staging.yml`

**O que faz:** smoke test Playwright contra `STAGING_BASE_URL`. Roda depois que `migrate-staging.yml` termina verde.

**Arquivos:**
- Novo: `.github/workflows/smoke-staging.yml`
- Novo: `tests/smoke/staging.spec.ts` — 3 cenários mínimos:
  1. `GET /` retorna 200, contém marca "BED Design" ou similar
  2. `GET /api/health` retorna 200, status `ok`
  3. `GET /admin/login` carrega o formulário (não testar login — banco vazio, sem AdminUser)

**Trigger:** `workflow_run` after `migrate-staging.yml` completed successfully. Adicionalmente `workflow_dispatch` pra rodar manual.

**Critério de aceite:**
- Smoke verde no commit atual de main.
- Falha quando Railway staging está fora — não tenta retry infinito (timeout 2min por teste).
- Output útil em caso de falha (screenshot + console log do Playwright).

**Dependência nova:** `@playwright/test` provavelmente já está em `devDependencies` (tem `tests/e2e.spec.ts` segundo o `tsconfig.ci.json`). Se não estiver instalado, adicione.

### PR-staging-C — Renomear `migrate.yml` → `migrate-prd.yml` + mudar trigger

**O que faz:** o workflow atual `migrate.yml` deixa de rodar em push pra `main` e passa a rodar em push de tags `v*`.

**Arquivos:**
- Renomeia: `.github/workflows/migrate.yml` → `migrate-prd.yml`
- Edita: troca `on: push: branches: [main]` por `on: push: tags: ['v*']`
- Edita: comentários internos do workflow refletindo novo gatilho

**Documentação:**
- Comentário no topo do arquivo explicando: "este workflow só dispara em tag. Tags são criadas pelo `promote.yml`. Não criar tag manualmente sem rodar promote — pula gate de smoke."

**Critério de aceite:**
- Tag fake `v0.0.0-test` (depois apagada) dispara o workflow.
- Push em main **não** dispara mais este workflow.
- Concurrency group continua `db-migrations` pra serializar com migrate-staging se houver overlap.

**⚠ Atenção operacional:** este PR só pode mergear **junto com** PR-staging-D, porque entre os dois o caminho para deploy de prd fica quebrado (migration via tag mas Railway prd ainda deploya em push main). Fazer PR-staging-C e PR-staging-D em **PR único composto** OU mergear em sequência apertada com PR-staging-D imediatamente atrás.

**Stakeholder precisa fazer manualmente** (alerte com `[ACTION REQUIRED]` no PR):
- Railway prd → Settings → Service → mudar Source Trigger de "branch main" para "tags v*" (ou equivalente). Sem isso, prd continua deployando direto de main sem passar pelo gate.

### PR-staging-D — `promote.yml`

**O que faz:** workflow `workflow_dispatch` que promove staging → prd. Roda em sequência: valida smoke verde no commit → cria tag → push da tag.

**Arquivos:**
- Novo: `.github/workflows/promote.yml`

**Comportamento:**
- Inputs:
  - `commit_sha` (string, default = head de main)
  - `reason` (string, obrigatório — vai pra audit log)
- Passos:
  1. Resolve SHA (head de main se input vazio)
  2. Chama GitHub API `repos/.../commits/{sha}/check-runs` filtrando por `smoke-staging.yml`, verifica `conclusion == success`. Se não, falha com mensagem clara.
  3. Lê última tag `v*`, calcula próxima (`v2026.05.14-1`, incrementando sufixo se a data já existe)
  4. `git tag` + `git push --tags`
  5. Output: link pra o workflow de migrate-prd que será disparado pela tag

**Critério de aceite:**
- Disparo do botão Actions → Promote → Run cria tag e dispara migrate-prd.
- Disparo sobre commit sem smoke verde **bloqueia** com mensagem leiga ("Staging não foi validado ainda — verifique o smoke antes").
- Audit trail: cada run tem actor + reason + tag criada.

### PR-staging-E — ADR-004 + atualização HANDOFF.md

**O que faz:** documenta a decisão arquitetural toda (`adr/ADR-004-staging-environment.md`) e atualiza o HANDOFF.md principal com runbook de release/rollback.

**Arquivos:**
- Novo: `docs/implementation/adr/ADR-004-staging-environment.md`
- Edita: `docs/implementation/HANDOFF.md` (seção nova "Release process" + "Rollback")

**Estrutura do ADR-004** (seguir padrão ADR-001 e ADR-003):
1. Sumário em 30s
2. Contexto (5 incidentes recentes — listar PRs/datas)
3. Decisão (4 elementos: projeto Railway separado, branching main=staging/tag=prd, workflows GHA split, smoke gate obrigatório)
4. Alternativas avaliadas (Railway Environments mesmo projeto, Vercel preview, 3 opções de branching, 3 opções de promoção)
5. Impacto na implementação
6. Estimativa de esforço
7. Riscos (cross-contamination, smoke flaky, schema drift, dev esquece staging)
8. Decisões pendentes (snapshot anonimizado futuro, multi-stakeholder review, LGPD em staging)
9. Referências

**Runbook no HANDOFF.md** — adicionar seção:
```
## Release process
1. Trabalho em branches de feature
2. PR pra main → CI verde → merge
3. Deploy automático em staging
4. migrate-staging.yml aplica migrations
5. smoke-staging.yml roda
6. QA valida em https://bed-site-staging.up.railway.app
7. Actions → Promote → Run (com motivo)
8. Tag criada → migrate-prd.yml + Railway prd deploya

## Rollback
- Reverter PR em main (ou git revert + tag nova)
- Tag inválida no Railway prd: redeploy do tag anterior em Settings
- Schema rolled_back manual: apenas via `prisma migrate resolve --rolled-back` em prd-db; nunca apagar linha de _prisma_migrations
```

**Critério de aceite:**
- ADR-004 segue exatamente o padrão de ADR-001/ADR-003.
- HANDOFF.md tem seções "Release process" e "Rollback" claras pra QA/stakeholder não-técnico.

---

## 5. Onda 2 — SPEC-007 (8 PRs)

**Pré-requisito:** Onda 1 inteira em prd, com pelo menos um ciclo válido (promote → tag → migrate-prd verde → app saudável).

A SPEC-007 já tem plano detalhado em §5 do documento. Resumo:

```
PR-1 (gate) ─ Schema único + migration consolidada
              [F1 e F2 juntos numa migration só]
   │
   ├─→ PR-2a ─ API calculadora (/api/orcamentos/* + /api/admin/pricing-settings)
   │
   └─→ PR-2b ─ API pedido manual (POST /api/admin/orders)
        
   ├─→ PR-3a1 ─ UI /admin/orcamentos (Modo 2)
   ├─→ PR-3a2 ─ UI /admin/produtos/[id]/precificacao (Modo 1)
   ├─→ PR-3a3 ─ UI /admin/configuracoes/precificacao
   └─→ PR-3b ─ UI extensão modal "Novo Pedido"
        │
        └─→ PR-4 ─ Ponte: orçamento → pedido manual
```

**Use `cto-primo-rico` para coordenar:**
- Ele distribui pra `dev-backend` (PRs 1, 2a, 2b), `dev-frontend` (PRs 3a1/2/3, 3b, 4), `security-architect` (review PR-1 e PR-2b), `qa-tester` (validação ponta a ponta antes de cada promote).

**Não invente** entidades novas. A SPEC explicita em §2.1 e §2.3:
- Reaproveitar `Filament`, `Component`, `Printer`, `ProductFilament`, `ProductComponent`, `Product.printingMinutes/markupPercent/errorRatePercent/printerForCostId`, `AuditLog`, `PaymentInstallment`.
- Não criar `OrderAuditLog`, `FilamentType`, `OrderSource` enum, etc. (anti-padrões listados).

---

## 6. Regras críticas (memórias mecanizadas — não violar)

| Regra | Razão | Onde aplica |
|---|---|---|
| **Tema admin é claro inline, sem Tailwind dark** | PR-8a foi retrabalhado (#161) por usar `bg-zinc-700`/`emerald-600` | Toda nova tela em `/admin/**` (Onda 2 inteira) |
| **Sem `minWidth` fixo >700px em tabela admin** | Força scroll lateral em viewport ampla | Listagens `/admin/orcamentos`, `/admin/pedidos` |
| **`DATABASE_URL_*` é URL pública do Railway** (`*.proxy.rlwy.net`) — nunca interna | Memória `feedback_railway_db_url_publica.md` — PR-5 quebrou prd por 6min em 14/05 | Secrets do GitHub e env vars do Railway |
| **Migration `rolled_back` não é erro** — não abortar boot | Memória `feedback_rolled_back_migration_nao_eh_erro.md` — PR-5b quebrou prd por 18min em 14/05 | `scripts/start.mjs` já trata; cuidado em qualquer mexida no boot |
| **Não mergear migration enquanto Prisma CLI quebrado em prd** | Memória `feedback_no_migrations_until_cli_fixed.md` | PR-1 da SPEC-007 — só mergeia se `migrate-staging.yml` rodou verde primeiro |
| **Migration sem BOM (sem `efbbbf` no início)** | CI já tem check; mas vale conferir local antes | Migration do PR-1 SPEC-007 |
| **Pedidos `createdVia='admin'` não enviam email + somem de `/minha-conta`** | Regra global de SPEC-005 | PR-2b SPEC-007 ao criar order manual |
| **Cálculo financeiro sempre no backend, com `Decimal`** | Float JS quebra contas | `lib/pricing.ts` na Onda 2 |
| **Não copiar `node_modules` inteiro no Dockerfile** | Memória `project_railway_dockerfile_limits.md` — PRs #136/#137 derrubaram prd | Não mexa em Dockerfile sem necessidade extrema |
| **PrismaClient em Prisma 7 precisa de adapter** | Memória `feedback_prisma7_client_options.md` | Em scripts de boot, preferir `pg` direto (como `start.mjs` faz) |
| **Revert PR: criar branch a partir de `origin/main`** | Memória `feedback_revert_branch_from_origin_main.md` | Se precisar reverter algo nesta onda |
| **Stakeholder é não-técnico** | Reports em linguagem leiga | Toda comunicação fora de comentário de código |
| **Preferir ações automatizadas a instruções** | Memória `feedback_actions_over_instructions.md` | Quando puder rodar, rode; só liste passos quando precisar do stakeholder de fato |

---

## 7. Acessos e credenciais

| Item | Onde está | Notas |
|---|---|---|
| Repo GitHub | https://github.com/eduardushenrique-create/BED-Site | Acesso via `gh` CLI (stakeholder é admin) |
| Railway prd (BED-Site) | painel.railway.app/project/... | Stakeholder acessa; você só executa via GHA |
| Railway staging (BED-Site-Staging) | painel.railway.app/project/... | Idem |
| `DATABASE_URL_PRODUCTION` | secret GH | URL pública prd, formato `*.proxy.rlwy.net` |
| `DATABASE_URL_STAGING` | secret GH | URL pública staging, formato `*.proxy.rlwy.net` |
| `STAGING_BASE_URL` | secret GH | `https://bed-site-staging.up.railway.app` |
| Mercado Pago sandbox | stakeholder tem; ainda não setado em staging | Pedir só se algum PR precisar |
| Postgres staging (senha) | exposta no histórico da sessão anterior (Claude Code) | Stakeholder pode rotacionar via Railway → Postgres → Reset Password; depois atualiza secret `DATABASE_URL_STAGING` |

**Nunca commitar valores reais** em arquivo do repo (env, ADR, doc). Use placeholders / referências.

---

## 8. Como pedir aprovação ao stakeholder

Padrão de comunicação:

- **PRs entregues:** posta link do PR, descreve em 2-3 bullets em português o que muda (NÃO em linguagem técnica). Inclui screenshot/print quando faz sentido (telas).
- **Decisões de produto:** apresenta 2-3 opções com trade-off em linguagem leiga. Use `AskUserQuestion` se houver ferramenta; senão, pergunta direta numerada.
- **Decisões técnicas internas:** NÃO pergunta, decide e justifica em 1 frase no PR (ou no commit).
- **Bloqueios externos** (Railway, GitHub, conta de terceiro): marca `[ACTION REQUIRED]` no comentário, lista o que ele precisa fazer manualmente.
- **Reports periódicos:** após cada PR mergeado, atualiza HANDOFF.md ou abre comentário com status.

---

## 9. Sinal de "tudo pronto"

Você terminou esta onda quando:

**Onda 1:**
- ✅ 5 PRs mergeados em main
- ✅ Tag `v2026.05.XX-1` (ou próxima) criada via Promote workflow
- ✅ Prd deployado a partir da tag, app saudável, `/api/health` 200
- ✅ ADR-004 publicado, HANDOFF.md atualizado com runbook
- ✅ Stakeholder consegue ver staging e prd lado a lado

**Onda 2 (SPEC-007):**
- ✅ Checklist §6 da SPEC-007 todo verde
- ✅ Stakeholder cria 3 orçamentos pela UI (substituiu a planilha)
- ✅ 1 orçamento convertido em pedido manual
- ✅ Pedidos do site continuam funcionando (regressão zero)
- ✅ Grep `bg-zinc\|dark:` em `/admin/orcamentos`, `/admin/configuracoes/precificacao`, `/admin/produtos/[id]/precificacao` retorna zero

---

## 10. O que NÃO fazer

- ❌ Não tocar em código de produção sem staging operacional primeiro.
- ❌ Não pular a Onda 1 mesmo que a Onda 2 pareça mais "valiosa" — a infra de staging é o que protege a Onda 2.
- ❌ Não inventar entidades, enums, tabelas ou endpoints além do que SPEC-007 §3 explicita.
- ❌ Não migrar `paymentStatus`/`fulfillmentStatus` de `String` para enum Prisma.
- ❌ Não usar Tailwind ou tema dark em `/admin/**`.
- ❌ Não fazer upload de arquivos no item personalizado (cortado do MVP por decisão do stakeholder).
- ❌ Não importar dados pessoais reais de prd pra staging (banco vazio, popular manualmente — decisão do stakeholder).
- ❌ Não commitar credenciais. Não commitar valores de env. Não commitar a `DATABASE_URL_STAGING`.
- ❌ Não responder ao stakeholder em jargão técnico ("schema drift", "idempotência", "cross-cutting concern"). Traduzir.

---

## 11. Mensagem inicial sugerida pro stakeholder na nova sessão

> "Oi Edu, retomei a partir do handoff. Confirmo: SPEC-007 está completa, Railway staging está em pé, secrets do GitHub configurados. Vou começar pela Onda 1 (infra de staging) com o PR-staging-A. Aviso quando o primeiro PR estiver pronto pra você revisar."

Boa execução. 🚀
