# ADR-002 — Aplicar Prisma migrations via GitHub Action, fora do runtime do Railway

## Status
Proposto — 2026-05-13

## Contexto

Migrations do Prisma em produção estão quebradas há semanas. O sintoma se repetiu 2× em 2026-05-13:

1. **Incidente original (manhã):** migration `20260528000000_order_discount_reason` nunca foi aplicada no Postgres → coluna esperada pelo Prisma client não existia → listagem de pedidos caía em fallback `localDb` silencioso → **4 pedidos perdidos (R$ 822), 1 invisível**.
2. **Reincidência (PR #141 às 21:03 UTC):** migration `20260529000000_payment_installments_and_partial` (da SPEC-005 fase 1) também não aplicou → Prisma client passou a esperar colunas inexistentes em `Order`/`OrderItem` → painel admin quebrou (produtos sumindo, pedidos não listando) → revert emergencial em #142 ~8 min depois.

### Causa raiz validada

`scripts/start.mjs` chama `node node_modules/prisma/build/index.js migrate deploy` no boot. Com Prisma **7.8**, esse comando requer `@prisma/config` em runtime, que por sua vez requer `effect`, `c12`, `deepmerge-ts`, `empathic` — **nenhum desses está no runner image**. O Dockerfile só copia `node_modules/prisma` e `node_modules/@prisma` do builder.

Logs do Railway confirmaram: `Error: Cannot find module 'effect'`. **Toda execução de `prisma migrate deploy` no startup falha desde a atualização para Prisma 7.** O fallback SQL inline no `start.mjs` só conhece duas migrations antigas e ignora qualquer migration nova — silenciosamente.

### Forças em jogo

- **Stack:** Next.js 16 standalone + Prisma 7 + Postgres no Railway. Auto-deploy disparado por `push` para `main`.
- **CI atual (`.github/workflows/ci.yml`):** Roda lint/typecheck/build/`prisma generate` em PR e push. **Já tem `npm ci` completo** — Prisma CLI funciona perfeitamente lá.
- **Healthcheck `/api/health`** já está em produção (#135) e detecta mismatch schema↔client. Funciona como rede de segurança pós-fato, mas não previne o quebra.
- **Memória institucional crítica:** copiar `node_modules` inteiro pro runner derruba o Railway (PR #136 incidente, ~500MB extra estoura algum limite do plano). Confirmado em [project_railway_dockerfile_limits.md](../../../C:/Users/eduar/.claude/projects/C--PROJETOS-BED-Site/memory/project_railway_dockerfile_limits.md).
- **Prisma client em runtime usa `@prisma/adapter-pg`, não o CLI.** O CLI no container só existe para `migrate deploy` no boot — e é justamente esse uso que está quebrado. **Removê-lo do runtime não tem efeito colateral no funcionamento do app.**

### Não-objetivos

- Não resolve a dívida técnica de `OrderItem.product` ser NOT NULL com órfãos no banco (assunto separado, pendência média do handoff).
- Não substitui o fallback localDb em `lib/database.ts` (pendência separada — ver memória do incidente).

---

## Decisão

**Adotar um GitHub Action dedicado (`migrate.yml`) que executa `prisma migrate deploy` contra o Postgres de produção em todo `push` para `main`, ANTES do Railway concluir o deploy. Remover a tentativa de `prisma migrate deploy` do `scripts/start.mjs`.**

Em uma frase: **migrar é trabalho do CI/CD, não do app subindo.**

### Por que essa é a opção certa

- **Onde funciona, é onde a gente roda.** O runner GitHub já tem o `node_modules` completo via `npm ci`. Zero gambiarra para fazer o CLI funcionar.
- **Não toca no Dockerfile.** Risco zero de repetir o incidente do PR #136 (imagem inchada).
- **Desacopla runtime do app de operações de banco.** Boot do container vira fast-path: app sobe ou não sobe, sem dependência do estado das migrations.
- **Falha visível.** Se a migration falhar, o workflow falha, GitHub manda email, o painel de Actions mostra vermelho. Hoje a falha é silenciosa.
- **É a solução já recomendada pelo handoff do incidente.** A memória `project_railway_dockerfile_limits.md:23` aponta isso explicitamente como "alternativa estrutural".

---

## Opções consideradas

### Opção A — GitHub Action separado para migrations (ESCOLHIDA)

Novo workflow `.github/workflows/migrate.yml`:

```yaml
name: Database Migrations
on:
  push:
    branches: [main]
  workflow_dispatch:        # botão de "run again" manual

concurrency:
  group: db-migrations
  cancel-in-progress: false # NUNCA cancelar migration no meio

jobs:
  migrate:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci --prefer-offline --no-audit
      - run: npx prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL_PRODUCTION }}
```

Complemento: o `scripts/start.mjs` perde a chamada de `prisma migrate deploy` e passa a **só validar** se a migration está aplicada (lendo `_prisma_migrations` ou batendo no healthcheck). Se schema estiver atrasado, **fail-fast** em produção (não sobe) e log explícito. Em dev, segue subindo.

| Dimensão | Avaliação |
|---|---|
| Complexidade | **Baixa** — um arquivo YAML novo, ~25 linhas; remoção de ~30 linhas do `start.mjs` |
| Custo operacional | **Zero** — minutos de Action grátis no plano free para repos públicos/privados pequenos |
| Risco de regressão | **Baixíssimo** — não toca Dockerfile, não toca código de app |
| Reversibilidade | **Trivial** — deletar `migrate.yml` e a operação volta a depender (falhar) no startup |
| Familiaridade do time | **Alta** — CI atual já é GitHub Actions; padrão amplamente conhecido |
| Manutenção | **Baixa** — workflow YAML congelado; só muda se migrar para outro CI |

**Pros:**
- Resolve a causa raiz (CLI quebrado no Dockerfile) **sem mexer no Dockerfile**.
- Migration vira evento auditável no GitHub (data, autor, resultado).
- Pode rodar `prisma migrate deploy` **antes** do Railway terminar o build do Docker — janela típica de Action terminar em ~30-60s vs. Docker build ~2-3min.
- Permite no futuro adicionar `prisma migrate status` em PR check, bloqueando merge se a migration não está pronta.

**Cons:**
- Requer secret `DATABASE_URL_PRODUCTION` no GitHub (já é necessária no Railway de qualquer forma — só duplica a configuração).
- Race condition residual: se Action passa mas atrasa, Railway pode subir o app com schema antigo por alguns segundos. **Mitigação:** healthcheck `/api/health` (já em prod) detecta mismatch; fail-fast no `start.mjs` (proposto) impede o app de servir tráfego.
- Migration que falha não impede o Railway de subir o novo código (deploys são independentes). **Mitigação:** fail-fast no startup garante que o app não serve até a migration passar.

---

### Opção B — Patchar Dockerfile com dependências cirúrgicas

Copiar `node_modules/effect`, `node_modules/c12`, `node_modules/deepmerge-ts`, `node_modules/empathic` (+ todas as transitivas explícitas) pro runner.

| Dimensão | Avaliação |
|---|---|
| Complexidade | **Média** — mapear cadeia de transitivas é tedioso e propenso a quebrar |
| Custo operacional | Zero |
| Risco de regressão | **Médio** — cada bump do Prisma pode adicionar novas deps; falha silencia até a próxima migration |
| Reversibilidade | Reversível mas com cuidado (já vimos o que mexer no Dockerfile pode fazer) |

**Pros:**
- Mantém fluxo atual (migration no startup) sem mudar arquitetura.
- Não exige secret no GitHub.

**Cons:**
- **Frágil:** novas versões do Prisma adicionam deps imprevisíveis. Vamos descobrir do jeito ruim de novo.
- **Mexe no Dockerfile.** Memória institucional grita pra não fazer (PR #136 quebrou tudo).
- **Esconde o problema:** continua com a anti-arquitetura "app é responsável por migrar banco".

---

### Opção C — Aplicação manual SQL antes de cada merge (status quo informal)

Para cada migration nova, abrir Railway → Postgres → Query, colar o SQL, mergear o PR depois.

| Dimensão | Avaliação |
|---|---|
| Complexidade | Trivial (na hora) |
| Custo operacional | **Alto** — humano dependente; já causou 2 incidentes no mesmo dia |
| Risco de regressão | **Alto** — esquecer 1 vez = produção quebrada |
| Reversibilidade | N/A |

**Pros:**
- Zero mudança técnica.

**Cons:**
- **Não escala:** já falhou no dia 2026-05-13 duas vezes.
- Handoff aponta que o console SQL do Railway tem comportamento errático em transações multi-statement.
- Não auditável fora do banco.
- Contraria preferência declarada do stakeholder por automação ([feedback_actions_over_instructions](../../../C:/Users/eduar/.claude/projects/C--PROJETOS-BED-Site/memory/feedback_actions_over_instructions.md)).

---

## Análise de trade-offs

| Critério | Opção A (Action) | Opção B (Dockerfile) | Opção C (Manual) |
|---|---|---|---|
| Resolve causa raiz | ✅ | ⚠️ Patch | ❌ Não, mitiga |
| Risco de quebrar prod no rollout | **Baixíssimo** | **Médio-alto** | Nulo (não muda nada) |
| Sustentável a longo prazo | ✅ | ⚠️ Frágil | ❌ |
| Visibilidade quando falha | **Alta** (email + check) | Mesma de hoje (silenciosa) | N/A |
| Esforço de implementação | ~1h | ~2-4h (mapear deps) | Zero |
| Esforço contínuo | Zero | Cada bump do Prisma | A cada migration |

**A trade-off decisiva:** Opção B "parece" mais barata porque mantém arquitetura atual, mas a arquitetura atual **já provou ser errada duas vezes em um dia**. O custo de continuar nela é alto e oculto. A Opção A inverte: paga um custo único pequeno para eliminar a classe inteira de problema.

---

## Consequências

**Fica mais fácil:**
- Aplicar qualquer migration nova sem medo de quebrar prod.
- Auditar quando cada migration foi aplicada (histórico de Actions).
- Desbloquear a **SPEC-005** (atualmente bloqueada — ver [project_spec005_status](../../../C:/Users/eduar/.claude/projects/C--PROJETOS-BED-Site/memory/project_spec005_status.md)).
- Adicionar gates de pré-merge no futuro (ex.: `prisma migrate status` em PR check).

**Fica mais difícil:**
- Rotação de credenciais do banco passa a tocar 2 lugares (Railway + GitHub secret). Mitigação: usar a mesma `DATABASE_URL` em ambos via documentação.

**O que vamos precisar revisitar:**
- Quando Prisma 8 sair, validar que o CLI funciona no runner Ubuntu (esperado: sim, mas confirmar).
- Race condition Action × Railway: monitorar primeiros deploys e medir o tempo entre "migration done" e "Railway live". Se Railway frequentemente termina antes, considerar adicionar um delay ou pre-deploy hook futuro.

---

## Action items

1. [ ] Criar `.github/workflows/migrate.yml` conforme template acima.
2. [ ] Configurar secret `DATABASE_URL_PRODUCTION` no GitHub (Settings → Secrets and variables → Actions). Mesmo valor já presente em Railway.
3. [ ] Testar o workflow em PR de validação: criar branch com uma migration trivial e inerte (ex.: `ALTER TABLE "Order" ADD COLUMN "_migrate_canary_v1" TEXT`); rodar `workflow_dispatch` apontando pra essa branch contra uma DB de staging (se houver) ou criar Postgres temporário no Railway só para o teste.
4. [ ] Após validação: editar `scripts/start.mjs` para remover a chamada `runMigrationsCli()` e o `applySqlFallback()`. Adicionar verificação fail-fast: ler `_prisma_migrations` no boot e abortar se houver migration faltando vs. `prisma/migrations/`.
5. [ ] Atualizar `Dockerfile`: remover `COPY --from=builder ... /app/node_modules/prisma` e `.../@prisma` (não são mais necessários no runner). Redução de imagem ~30-40 MB.
6. [ ] Remover migration canary da action item 3 com `ALTER TABLE "Order" DROP COLUMN "_migrate_canary_v1"`.
7. [ ] Atualizar memória `feedback_no_migrations_until_cli_fixed` → marcar como resolvido após canary passar em prod.
8. [ ] Desbloquear SPEC-005 fase 1: reabrir o equivalente do PR #141 (migration + schema) e mergear; o Action vai aplicar.

Sequência sugerida: **2 PRs separados.**
- **PR-A** (escopo desta ADR): items 1+2+3+4+5+6. Resolve a infra. Sem mudança de feature.
- **PR-B** (desbloqueio da SPEC-005): item 8. Só executar depois do PR-A em prod com ao menos 1 deploy bem-sucedido.

---

## Deciders

- **Stakeholder do projeto (Edu)** — aprovação de produto e de operação.
- (Não há mais ninguém no momento; decisão técnica unilateral com validação do stakeholder.)
