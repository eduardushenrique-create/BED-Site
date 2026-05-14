# ADR-004 — Ambiente de staging entre `main` e produção

**Status:** Aprovado
**Data:** 2026-05-14
**Decididores:** Stakeholder do projeto (Edu)
**Relaciona-se com:** [ADR-002](#) (migration via GitHub Action) · [ADR-003](ADR-003-spec-005-safety-review.md) · [SPEC-007](../spec/SPEC-007-orcamentos-e-pedidos-manuais.md) · [HANDOFF-SPEC-007.md](../HANDOFF-SPEC-007.md)

---

## Sumário em 30 segundos

A partir desta ADR, **produção deixa de receber código diretamente de `main`**. O fluxo passa a ser:

```
push em main  ──►  Railway staging (auto-deploy)
                   │
                   ├─►  migrate-staging.yml  (aplica migrations em staging-db)
                   │
                   └─►  smoke-staging.yml    (Playwright contra staging URL)
                          │
                          ▼   (QA manual valida)
              Actions → Promote staging → prd
                          │   (gate: smoke verde + reason obrigatório)
                          ├─►  cria tag v2026.05.14-N
                          │     └─►  migrate-prd.yml (aplica migrations em prd-db)
                          │
                          └─►  push em branch `production` (--force-with-lease)
                                └─►  Railway prd detecta push e deploya o commit
```

**Custo:** 1 ambiente Railway extra (~US$ 5/mês com free tier), 5 PRs (~1 dia útil), ~2 min adicionais por release. **Benefício:** zero deploy em prd sem validação automática + humana primeiro.

> **Atualização 2026-05-14 (pós-implementação):** descobrimos que [Railway não suporta deploy em push de tag](https://docs.railway.com/deployments/github-autodeploys) — só de branch. Por isso o gate de Railway prd é fechado via branch dedicada **`production`** (atualizada pelo `promote.yml` em conjunto com a tag), e não pela tag direta. A tag `v*` mantém seu papel como audit trail + gatilho do `migrate-prd.yml`. Detalhes em §"Decisão" item 2.

> **Atualização 2026-05-14 (pós-teste 3):** o smoke automático foi movido para dentro do `migrate-staging.yml` (como job dependente) em vez de viver em workflow separado. Razão: workflows disparados via `workflow_run` recebem `GITHUB_SHA = HEAD do branch no momento do evento`, não o SHA do upstream. Em rajadas de push, isso fazia o check_run "Playwright smoke" ficar registrado num SHA diferente do que foi testado — o gate aceitava promoções de commits "validados" sob o SHA de outro commit. Solução: smoke + migrate no mesmo workflow = mesmo contexto = check_run no SHA correto. `smoke-staging.yml` continua existindo apenas para disparo manual (workflow_dispatch com input `ref`), com job nomeado **"Playwright smoke (manual)"** para o promote ignorar.

---

## Contexto

Em **30 dias** (2026-04-14 → 2026-05-14), o ambiente de produção sofreu **5 incidentes** com causa-raiz "código mergeado em main foi direto pra prd sem nenhuma validação intermediária":

| Data | PR | Sintoma | Duração impacto |
|---|---|---|---|
| 2026-05-09 | [#133](https://github.com/eduardushenrique-create/BED-Site/pull/133) | Hardening pós-incidente quebrou boot — 502 | ~25min |
| 2026-05-13 (manhã) | [#141](https://github.com/eduardushenrique-create/BED-Site/pull/141) | Schema mergeado sem migration aplicada — Prisma client esperava colunas inexistentes | ~12min |
| 2026-05-13 (tarde) | [#143](https://github.com/eduardushenrique-create/BED-Site/pull/143) | Boot fail-fast mal escrito quebrou o canary | ~8min |
| 2026-05-14 (manhã) | [#150](https://github.com/eduardushenrique-create/BED-Site/pull/150) | `DATABASE_URL_PRODUCTION` setado com URL interna do Railway — migration falhou em CI mas prd já tinha subido | ~6min |
| 2026-05-14 (tarde) | [#153](https://github.com/eduardushenrique-create/BED-Site/pull/153) | Boot abortou em migration `rolled_back` (estado válido tratado como erro) | ~18min |

**~70 minutos de downtime acumulado**, pedidos preservados (resilência do client), mas a confiança operacional já está abalada. O próximo incidente é provável e pode coincidir com horário comercial cheio.

### Forças em jogo

- **Histórico:** 5 incidentes em 30 dias, todos com mesma assinatura (sem gate). O padrão se repete porque a defesa é só "ler com cuidado o PR + ter sorte com timing do Railway".
- **Próximo escopo (SPEC-007):** introduz migration consolidada nova, 6 colunas em `Order`/`OrderItem`, mudança em `OrderItem.productId` para nullable, e ~3000 linhas de UI nova. Mergear isso direto em main → prd seria irresponsável dado o histórico.
- **Restrições:**
  - Stakeholder não-técnico → o gate humano precisa ser **simples** ("Run workflow + motivo").
  - Orçamento operacional baixo → preferimos Railway (já em uso) a Vercel.
  - LGPD → staging não pode conter dados pessoais reais.
- **O que já tínhamos:** ADR-002 moveu migrations pra GitHub Action (PR #150-152). ADR-003 endureceu CI (forbidden-patterns, REQUIRED_ORDER_COLUMNS, boot smoke). Mas tudo isso roda **pré-merge**, nada **pós-merge antes do deploy em prd**.

---

## Decisão

Implementar ambiente de staging com **4 elementos**:

### 1. Projeto Railway separado (não Environment)

- Criar projeto **`BED-Site-Staging`** distinto, com seu próprio Postgres.
- Postgres vazio. Sem dados reais. Stakeholder popula manualmente quando quiser testar.
- Mesma `NEXTAUTH_SECRET` distinta (segurança).
- Demais env vars (MP, Resend, Sentry, R2, OAuth, Turnstile, Upstash) **propositalmente vazias** — cada feature degrada com fallback seguro. Adicionar caso a caso quando o teste exigir.

### 2. Branching: `main` = staging, `production` + tag `v*` = prd

- `main` continua sendo a única branch de feature/integração.
- **Push em main:** Railway staging faz auto-deploy + `migrate-staging.yml` aplica migrations em staging-db.
- **Promote (manual, com validação):**
  - **Cria tag `v*`** → `migrate-prd.yml` aplica migrations em prd-db.
  - **Push em branch `production`** (`--force-with-lease`) → Railway prd detecta push e deploya o commit.
- Branch `production` é **exclusivamente atualizada pelo `promote.yml`**. Recomenda-se proteção (no commit direto, no push manual).

**Por que duas coisas (tag + branch) em vez de só uma?**
- Tag é **imutável**: serve de audit trail e referência histórica do que foi promovido.
- Branch `production` é **móvel**: Railway só sabe escutar branch, não tag — limitação documentada em [Railway docs](https://docs.railway.com/deployments/github-autodeploys) (não há previsão de suporte a tag nos triggers).
- Os dois mecanismos sempre apontam pro mesmo SHA quando o promote completa com sucesso. Se divergirem, é sinal de incidente.

### 3. Workflows GHA split

| Workflow | Trigger | Função |
|---|---|---|
| `migrate-staging.yml` | push em main | Aplicar migrations em staging-db (`DATABASE_URL_STAGING`) |
| `smoke-staging.yml` | workflow_run após migrate-staging success | Playwright contra `STAGING_BASE_URL` — 3 cenários (home, /api/health, /admin) |
| `migrate-prd.yml` | push de tag `v*` | Aplicar migrations em prd-db (`DATABASE_URL_PRODUCTION`) — renomeado de `migrate.yml` |
| `promote.yml` | workflow_dispatch manual | Valida smoke verde no SHA + cria tag `vYYYY.MM.DD-N` |

Concurrency groups separados (`db-migrations` vs `db-migrations-staging`) garantem que migrations de prd e staging não bloqueiam entre si.

### 4. Gate de smoke obrigatório no promote

`promote.yml` chama `gh api .../commits/{sha}/check-runs?check_name=Playwright%20smoke` e bloqueia se nenhuma execução tiver `conclusion=success`. A mensagem de erro é em linguagem leiga:

> *"Staging não foi validado para o commit {short}. Verifique em Actions → Smoke — Staging se rodou e ficou verde. Se não rodou, dispare manualmente."*

---

## Alternativas avaliadas

### A. Railway Environments (mesmo projeto, ambiente "staging")

Railway suporta múltiplos environments dentro do mesmo projeto. **Rejeitado** porque:
- Compartilha variáveis e secrets entre ambientes por padrão — erro de digitação pode vazar segredos do prd pra staging ou vice-versa.
- Histórico de cobrança fica misturado.
- Não há isolation real de "ambiente caiu por algum bug" — incidente em staging poderia derrubar prd.

### B. Vercel preview deploys

Vercel oferece preview por PR. **Rejeitado** porque:
- Adiciona segundo provedor (operacionalmente caro pra time pequeno).
- Migrations seriam aplicadas a um banco efêmero — não testa o fluxo real.
- Custo extra com plano Pro.

### C. Branching com `staging` branch separada

Manter `main` apontando pra prd e criar branch `staging`. PRs em staging → testes → merge em main. **Rejeitado** porque:
- Sobrecarga cognitiva: 2 branches longas, conflitos frequentes.
- Stakeholder não-técnico precisaria entender git flow.
- Não resolve o problema raiz (gate de release).

### D. Promoção por release do GitHub (UI)

Em vez de `promote.yml`, criar release manualmente no GitHub UI. **Rejeitado** porque:
- Não há gate automático de smoke (humano pode esquecer de checar).
- Sem audit trail uniforme (release notes ficam soltos).

A decisão D foi a mais próxima da escolhida — `promote.yml` essencialmente é "release programática com gate".

---

## Impacto na implementação

### Mudanças necessárias

- ✅ **PR-staging-A** (#163): cria `migrate-staging.yml`.
- ✅ **PR-staging-B** (#164): cria `smoke-staging.yml` + `playwright.staging.config.ts` + `tests/smoke/staging.spec.ts`.
- ✅ **PR-staging-C+D** (#165): renomeia `migrate.yml` → `migrate-prd.yml` com trigger tag + cria `promote.yml`.
- ✅ **PR-staging-E**: este ADR + runbook no HANDOFF.

### Ações manuais do stakeholder (não automatizáveis)

1. **Criar projeto Railway staging** (`BED-Site-Staging`) com Postgres — **JÁ FEITO** (handoff §3.2).
2. **Cadastrar secrets no GitHub:**
   - `DATABASE_URL_STAGING` (URL pública staging-db)
   - `STAGING_BASE_URL` (URL Railway staging)
   - **JÁ FEITO** (handoff §3.3).
3. **Criar branch `production`** apontando para HEAD de `main` no momento da virada — **JÁ FEITO** em 2026-05-14 (push direto, primeira e única vez fora do `promote.yml`).
4. **Reconfigurar Railway prd para escutar a branch `production` em vez de `main`** — **PENDENTE.** Sem isso, prd continua deployando todo push em main. Stakeholder faz manualmente no painel Railway → Service → Settings → Source/Branch.
5. **(Opcional, recomendado)** Adicionar regra de proteção em `production` no GitHub Settings → Branches → "Restrict who can push" para impedir commits diretos. Apenas o `promote.yml` (via `GITHUB_TOKEN`) deve poder atualizar essa branch.

### Estimativa de esforço

- Implementação dos 5 PRs: **~4 horas de implementação técnica** (uma manhã).
- Configuração externa do stakeholder: **~30 minutos** (Railway + secrets, este último já feito).
- Curva de aprendizado do stakeholder do novo fluxo: **~10 minutos** (basta seguir o runbook do HANDOFF).

---

## Riscos

### R1 — Smoke flaky bloqueia promote

**Cenário:** Railway staging tem cold start; primeira request demora e Playwright dá timeout. Smoke fica vermelho falsamente, stakeholder não consegue promover.

**Mitigação:**
- Timeouts generosos no `playwright.staging.config.ts` (test 2min, navegação 60s, ação 30s).
- `workflow_dispatch` permite re-disparar smoke manualmente sem novo commit.
- Se Railway free tier dormir o staging com frequência, considerar upgrade ou warm-up ping em cron (não no escopo desta ADR).

**Severidade:** baixa-média. Se acontecer, perda de tempo (re-rodar smoke), não regressão.

### R2 — Cross-contamination de secrets

**Cenário:** stakeholder copia `.env` de prd pra staging por engano, expondo MP de prd em ambiente que não tem o mesmo controle.

**Mitigação:**
- Projetos Railway separados → cada um tem painel próprio, secret de um não vaza pro outro.
- Secrets do GitHub separados (`DATABASE_URL_STAGING` vs `_PRODUCTION`).
- Documentar em HANDOFF que **staging tem env vars próprias e propositalmente vazias** — não copiar de prd.

**Severidade:** média. Vigilância recorrente, não automatizável.

### R3 — Schema drift entre staging e prd

**Cenário:** alguém aplica migration manual em staging-db (via `prisma migrate dev` local), depois esquece, e prd recebe coisa diferente.

**Mitigação:**
- Workflows aplicam **apenas** `prisma migrate deploy` (não `dev`). Migrations vivem no repo, não em manual SQL.
- `migrate-staging.yml` e `migrate-prd.yml` rodam **o mesmo `prisma migrate deploy`** contra o repo, em momentos diferentes.
- `prisma migrate status` no final de cada workflow detecta drift.

**Severidade:** baixa. Disciplina + status check pegam.

### R4 — Dev esquece de testar em staging antes de promover

**Cenário:** stakeholder confia no CI verde e dispara Promote sem olhar staging.

**Mitigação:**
- O gate técnico (`smoke-staging.yml` verde) é **automático** — basta o smoke ter rodado e passado.
- Para mudanças visuais (UI), o smoke não detecta regressão visual — humano precisa abrir `https://bed-site-staging.up.railway.app` e olhar. Runbook do HANDOFF deixa isso explícito.
- O campo `reason` obrigatório no Promote força reflexão mínima ("estou promovendo X porque…").

**Severidade:** baixa. Cultura, não automatização.

### R5-bis — Branch `production` divergir do que está rodando em prd

**Cenário:** alguém faz `git push --force production <sha>` manualmente, ou Railway prd está pinado num deploy antigo. HEAD de `production` deixa de refletir o que realmente está em prd → audit trail fica enganoso.

**Mitigação:**
- Proteção da branch `production` (item 5 das ações manuais) restringe push a Actions.
- `--force-with-lease` no `promote.yml` falha se a branch tiver avançado fora do controle (sinal de manipulação).
- Railway prd sempre exibe o SHA do deploy ativo — comparar com HEAD de `production` quando houver dúvida.

**Severidade:** baixa-média. Detectável visualmente. Não compromete o gate, só polui audit.

### R5 — Staging com dados reais (LGPD)

**Cenário:** alguém copia dump de prd pra staging-db para "testar com dados reais", expondo dados pessoais de clientes em ambiente menos protegido.

**Mitigação:**
- Banco staging começa vazio.
- Stakeholder popula manualmente (decisão dele, handoff §3.2).
- ADR registra: **não fazer dump de prd pra staging.** Se precisar dados realistas, gerar fake.
- Não há automação que faça isso automaticamente — risco fica em disciplina.

**Severidade:** alta se acontecer, mas probabilidade baixa (precisa ação deliberada).

---

## Decisões pendentes (futuro)

Pontos identificados mas adiados para não inflar esta ADR:

1. **Snapshot anonimizado prd → staging.** Hoje staging começa vazio. Quando o catálogo crescer, pode valer pena ter um snapshot semanal com PII anonimizada. Fora de escopo até stakeholder pedir.
2. **Multi-stakeholder review com aprovação obrigatória.** Hoje o `promote.yml` aceita o disparo de qualquer pessoa com permissão `actions: write`. Quando o time crescer, exigir 2 aprovações. Fora de escopo enquanto o time é só o Edu.
3. **Auto-rollback em prd em caso de health 503 sustentado.** Hoje rollback é manual (vide runbook). Auto-rollback exige monitoramento externo + lógica de "qual tag voltar". Fora de escopo.
4. **Notificação Slack/email do promote.** Hoje só o `GITHUB_STEP_SUMMARY` registra. Notificação externa fora de escopo enquanto só uma pessoa promove.

---

## Referências

- [PR #163](https://github.com/eduardushenrique-create/BED-Site/pull/163) — PR-staging-A (migrate-staging.yml)
- [PR #164](https://github.com/eduardushenrique-create/BED-Site/pull/164) — PR-staging-B (smoke-staging.yml + tests)
- [PR #165](https://github.com/eduardushenrique-create/BED-Site/pull/165) — PR-staging-C+D (migrate-prd + promote)
- [HANDOFF-SPEC-007.md](../HANDOFF-SPEC-007.md) — plano da Onda 1
- [ADR-003](ADR-003-spec-005-safety-review.md) — gates pré-merge (complementa esta ADR)
- Memórias mecanizadas: `feedback_railway_db_url_publica.md`, `feedback_rolled_back_migration_nao_eh_erro.md`, `project_railway_dockerfile_limits.md`
