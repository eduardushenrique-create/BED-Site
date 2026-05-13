# Post-mortem — Dois deploys que derrubaram produção em 2026-05-13

> Autor: assistente Claude  | Data: 2026-05-13 | Status: **v2 (revisado por agente arquiteto + security-architect independentes)**
>
> **Aviso ao leitor:** este post-mortem é sobre erros que eu (assistente Claude) cometi. Não é exercício teórico — é compromisso público com mudanças concretas, **mecanizadas no repo**, que sobrevivam ao fato de que assistentes Claude não têm memória persistente entre sessões.

---

## 1. Sumário executivo

Em 2026-05-13, mergei dois PRs em ~30min que derrubaram produção sequencialmente:

| Hora UTC | Evento | Impacto |
|---|---|---|
| 21:03 | Merge do **PR #141** (SPEC-005 fase 1: schema novo) | Painel admin quebrou — produtos sumiram |
| 21:08 | Stakeholder detectou (~5min depois do deploy completar) | — |
| 21:11 | Revert emergencial (#142) → site volta | **RTO = 8 min** (detecção + ação) |
| 21:34 | Merge do **PR #143** (ADR-002: migrate via GitHub Action) | Boot do app falhou — site 502 |
| ~21:38 | Stakeholder detectou (~4min depois) | — |
| ~21:47 | Revert emergencial (#144) → site volta | **RTO = ~9 min** |

**Causa raiz comum, em duas camadas:**

- **Camada individual (minha):** li as memórias do projeto, mas tratei o conhecimento documentado como contexto opcional em vez de hard constraint. Em ambos os incidentes, a documentação interna **explicitamente alertava** para o tipo de erro que cometi.
- **Camada estrutural (sistema):** o pipeline atual permite que isso aconteça. **Auto-merge** habilitado em qualquer PR + **CI que valida só sintaxe** (não roda boot do app) + **único aprovador humano** + **sem ambiente intermediário** = qualquer descuido vira incidente em prod. As duas falhas individuais quebraram prod porque o sistema não tem rede de proteção.

**O que muda a partir de agora — em ordem de prioridade:**

1. **Mecanização (CR-7, CT-5, CR-8, CR-9):** controles enforçados pelo repo/GitHub, não por boa-vontade do agente.
2. **Detecção externa (CT-5):** UptimeRobot pingando `/api/health`, alerta independente do stakeholder ter os olhos no site.
3. **Validação de boot real (CT-1 + CT-7):** smoke test no CI + preview environment do Railway por PR.
4. **Tratar compromissos comportamentais como o que são:** promessas frágeis. Só o que está em arquivo do repo persiste.

**Veredicto da revisão por security-architect: NO-GO** para fechar este post-mortem com controles apenas comportamentais. **Top 3 bloqueadores antes de retomar trabalho:**

| # | Bloqueador | Tempo estimado |
|---|---|---|
| 1 | CT-5 (UptimeRobot) — detecção externa | ~15 min |
| 2 | CR-7 (label automático + branch protection) — mecaniza CR-1 | ~30 min |
| 3 | CR-1b — expandir lista sensível pra cobrir auth/webhooks/admin/segredos | ~10 min |

Total: ~1h de trabalho. **Recomendação dos revisores: bloquear novos PRs (não cosméticos) até esses 3 estarem em produção.**

---

## 2. Linha do tempo factual

### Estado de partida (antes dos meus deploys)

- Commit em `main`: `60aab7b7` — "EMERGENCIAL: revert PRs #136 + #137" (estado estável após o incidente da manhã)
- 5 pedidos visíveis em prod
- Memórias relevantes já existiam, registrando o aprendizado do dia
- Janela do incidente da manhã: ~14h-19h UTC (5h de turbulência)

### Sequência do incidente 1 — PR #141 (SPEC-005 fase 1)

| Hora UTC | Evento | Quem |
|---|---|---|
| ~20:45 | "Aprovação verbal pra mergear todos os PRs pendentes" | Stakeholder |
| 21:02 | Push `claude/strange-lalande-b2c1e1` (schema + migration) | Eu |
| 21:02 | CI inicia | GitHub |
| 21:03 | CI verde (1m25s). Auto-merge dispara → merge em main (`c6aa9971`) | gh + GitHub |
| 21:03–21:08 | Railway buildando + deployando | Railway |
| ~21:08 | "Produtos sumiram do painel" | Stakeholder |
| 21:09 | Cola handoff completo do incidente da manhã | Stakeholder |
| 21:09 | Reconheço o erro | Eu |
| 21:11 | PR #142 (revert) aberto e mergeado | Eu + auto-merge |
| ~21:13 | Site volta | Railway |

**RTO observado: 8 minutos** (5 detecção + 3 ação).

### Sequência do incidente 2 — PR #143 (ADR-002 PR-A)

| Hora UTC | Evento | Quem |
|---|---|---|
| 21:14–21:32 | Escrevo ADR-002, aprovado por mim mesmo + stakeholder | Eu |
| 21:32 | Validações locais: `prisma validate` ok, `node --check start.mjs` ok, YAML lint ok | Eu |
| 21:33 | Push, PR #143 aberto, CI inicia | Eu |
| ~21:34 | CI verde, auto-merge mergeia (`c1f2f91f`) | gh + GitHub |
| 21:34–21:38 | Workflow `Database Migrations` roda (canary aplicada) | GitHub Actions |
| 21:34–21:38 | Em paralelo: Railway builda imagem nova com `start.mjs` reescrito | Railway |
| ~21:38 | Container sobe; `new PrismaClient()` lança; fail-fast = exit(1); restart loop | Container |
| ~21:38 | Stakeholder detecta site 502 | Stakeholder |
| ~21:40 | Cola logs do Railway | Stakeholder |
| ~21:42 | Branch `hotfix/revert-pr-143`, commit revert | Eu |
| ~21:34 | PR #144 aberto, auto-merge mergeia | Eu + auto-merge |
| ~21:47 | Site volta | Railway |

**RTO observado: ~9 minutos** (~4 detecção + ~5 ação).

> **Nota crítica:** a "promessa de RTO < 5min" do plano de revert do PR #143 não bateu com a realidade. Sem alerta externo (UptimeRobot), a janela de detecção depende do stakeholder olhando o site. Se for fora do horário dele, RTO sobe drasticamente. **CT-5 ataca exatamente isso.**

---

## 3. Análise causal — incidente 1 (PR #141)

### O que eu fiz

Mergei migration nova em `prisma/migrations/20260529000000_payment_installments_and_partial/` + alterações em `prisma/schema.prisma` (colunas novas em `Order`, `OrderItem`, tabela nova `PaymentInstallment`).

### Por que isso quebrou (cadeia técnica)

1. Railway buildou imagem nova → `npx prisma generate` no Dockerfile fez Prisma client esperar as colunas novas.
2. `scripts/start.mjs` (versão pré-#143) tentou aplicar a migration via `prisma migrate deploy` no boot.
3. **Esse comando falha desde o upgrade pro Prisma 7** — runner image não tem `effect`/`c12`/`deepmerge-ts`/`empathic`.
4. O fallback SQL inline em `start.mjs` (linhas 69-110) só conhecia 2 migrations antigas — ignorou a minha.
5. App subiu com Prisma client esperando colunas que não existiam no banco.
6. Qualquer query em `Order`/`OrderItem` quebrou.
7. O painel admin caiu.

### Cinco whys — versão estendida (revisada)

1. **Por que o site quebrou?** Prisma client esperava colunas inexistentes.
2. **Por que esperava colunas inexistentes?** Migration nunca foi aplicada no banco, mas `prisma generate` no build incorporou as colunas no client.
3. **Por que a migration não foi aplicada?** `prisma migrate deploy` no startup falha desde o upgrade pro Prisma 7.
4. **Por que esse comando quebrado é o único caminho de migrações em prod?** Porque não há outro mecanismo (CI/CD, GitHub Action, etc.). O `start.mjs` era a única tentativa, e seu fallback era hardcoded em 2 migrations antigas.
5. **Por que mergei mesmo conhecendo essa fragilidade?** Porque (a) li parcialmente as memórias, (b) confundi "estado pós-recovery (#131-#132) estável" com "fluxo de migration funciona", (c) **o sistema permite mergear sem evidência real de que vai funcionar**. Auto-merge disparou em PR sensível sem checagem humana, sem boot real, sem evidência de que migration anterior está aplicada.

**Causa estrutural:** o pipeline `push main → Railway auto-deploy` não exige nenhum tipo de validação real do caminho que está sendo modificado. Auto-merge transforma "pus o código" em "está em prod" sem rede.

**Causa de processo:** "aprovação verbal abrangente para todos os PRs pendentes" é incompatível com PRs sensíveis. PRs em `prisma/migrations/` precisam de aprovação por PR, não por lote.

### Avisos explícitos das memórias que eu ignorei

| Memória | Linha | Aviso |
|---|---|---|
| `project_railway_dockerfile_limits.md` | 25 | "Prisma CLI quebrado no container ... `migrate deploy` no startup ... **sempre falha silenciosamente** — migrations continuam **exigindo aplicação manual via Railway → Postgres → Query**" |
| `project_incident_2026-05-13.md` | 10-13 | Descrição literal do cenário que reproduzi (migration não aplicada → Prisma client espera coluna → fallback localDb mascarando) |

Não foi falha de informação. Foi falha de leitura crítica E de mecanismo (sistema permitiu).

---

## 4. Análise causal — incidente 2 (PR #143)

### O que eu fiz

Reescrevi `scripts/start.mjs` substituindo "tentar migrar" por "validar schema":

```javascript
const mod = await import('@prisma/client')
const PrismaClient = mod.PrismaClient
client = new PrismaClient()  // ← sem options
```

Em caso de erro: `process.exit(1)` em produção.

### Por que isso quebrou (cadeia técnica)

Prisma 7 mudou a API: `new PrismaClient()` sem argumentos lança `PrismaClient needs to be constructed with a non-empty, valid PrismaClientOptions`. Exige adapter explícito. O pattern correto está em [`lib/prisma.ts:15-17`](C:\PROJETOS\BED-Site\lib\prisma.ts):

```ts
new PrismaClient({ adapter: new PrismaPg(databaseUrl) })
```

Eu **não consultei** esse arquivo. Copiei o pattern do `start.mjs` antigo (que tinha o mesmo bug, mascarado por try/catch silencioso). Meu try/catch novo era explícito → exit(1).

### Cinco whys — versão estendida (revisada)

1. **Por que o site quebrou?** `start.mjs` deu exit(1) em todos os 3 restarts do Railway.
2. **Por que deu exit(1)?** Prisma client lançou na inicialização; meu fail-fast capturou e abortou.
3. **Por que o Prisma client lançou?** `new PrismaClient()` sem options é proibido no Prisma 7.
4. **Por que escrevi código com esse bug?** Copiei do `start.mjs` antigo achando que era padrão válido. Não consultei `lib/prisma.ts`.
5. **Por que o pipeline permitiu esse código chegar a prod?** Porque o **CI nunca executa o `start.mjs` em ambiente próximo ao de produção**. Lint + Typecheck + Build validam sintaxe e build, **não comportamento em runtime**. O sistema não tem nenhum "smoke test" do boot.

**Causa estrutural:** ausência de teste de boot no CI. Bug de runtime trivial passou despercebido porque nenhuma camada o exercitou antes do deploy. CT-1 ataca isso.

**Causa de processo (já mencionada):** aprovação por lote + auto-merge no segundo PR sensível em <30min, em pleno momento de instabilidade pós-revert.

### Aviso explícito que eu ignorei

[`lib/prisma.ts`](C:\PROJETOS\BED-Site\lib\prisma.ts) é o arquivo canônico do projeto que mostra o pattern correto. Não é memória — é código vivo. Não consultei antes de inventar a inicialização.

E ignorei o princípio óbvio: **se você adiciona fail-fast novo, valide PRIMEIRO que o caminho de sucesso funciona**, não só que a falha é detectada.

---

## 5. Meta-causa — o padrão estrutural por trás dos dois

### Assinatura comum dos dois incidentes

| Padrão | Incidente 1 | Incidente 2 |
|---|---|---|
| Confiança em "parece funcionar" sem evidência | Achei que migrate deploy rodava | Achei que `new PrismaClient()` funcionava |
| Pular validação real porque "é simples" | "Só schema" | "Só infra" |
| CI verde como atestado de saúde | mergeei após 1m25s de CI | mergeei após ~1min de CI |
| Auto-merge em mudanças críticas | sim | sim |
| Documentação não-vinculante (memória/código) | memórias avisavam | `lib/prisma.ts` mostrava o jeito |

### Causa estrutural #1 — Pipeline sem rede de proteção

```
push main → CI (lint+build) → squash merge → Railway auto-deploy → produção
                                                        ↑
                                       sem boot test, sem staging, sem aprovação obrigatória
```

Cada elo da cadeia é frágil. Tirar um único erro do agente derruba prod. **A robustez não vem de nunca errar — vem de o sistema sobreviver a erros**. Hoje o sistema não sobrevive.

### Causa estrutural #2 — `start.mjs` oscila entre dois extremos

(Identificada pelo arquiteto na revisão)

- **Versão antiga:** silencioso ("resiliente"). Mascarou o incidente da manhã (4 pedidos perdidos, R$ 822).
- **Versão minha (PR #143):** fail-fast agressivo. Mascarou nada — derrubou tudo.

Falta uma estratégia coerente sobre **o que fazer quando schema/banco estão fora de sync**. Sem isso, qualquer reescrita pendula entre os dois polos. Ambos quebram coisas.

A correção real precisa: detectar mismatch + reportar via healthcheck + **subir mesmo assim com bandeira degradada**, em vez de exit(1) ou silenciar. Healthcheck `/api/health` virá vermelho, alerta UptimeRobot dispara, humano revisa.

### Causa estrutural #3 — Aprovação por lote em PRs heterogêneos

(Identificada pelo arquiteto na revisão)

"Aprovação verbal pra mergear todos os PRs pendentes" agrupou PRs com graus de risco MUITO diferentes (cosmético vs. schema). PRs sensíveis precisam de aprovação por PR. CR-7 endereça.

### Causa individual — a parte minha

A causa "individual" não desaparece, mas precisa ser tratada com realismo: **assistentes Claude não têm memória persistente entre sessões**. Compromissos comportamentais ("vou consultar X", "vou esperar Y") **não sobrevivem** a uma nova sessão. Só sobrevive o que está mecanizado:
- No repo (templates, CI checks, branch protection, comentários-trava)
- No GitHub (branch protection rules, CODEOWNERS, secrets)
- Nas memórias do projeto (como "feedback hard rules")

Toda a §6 abaixo segue esse princípio: cada controle tem um **mecanismo de enforcement**, não só convenção.

---

## 6. Controles propostos (revisados após auditoria dos agentes)

### 6.1 — Controles MECANIZADOS (entram em vigor automaticamente; sobrevivem a troca de sessão)

#### CR-1b — Lista expandida de "arquivos sensíveis"

**Enforcement:** label automático `sensitive-area` aplicado por GitHub Action `actions/labeler` baseado em paths.

**Paths sensíveis:**

```yaml
# .github/labeler.yml
sensitive-area:
  - Dockerfile
  - railway.toml
  - next.config.*
  - tsconfig*.json
  - package.json
  - package-lock.json
  - scripts/**
  - .github/workflows/**
  - prisma/schema.prisma
  - prisma/migrations/**
  - lib/prisma.ts
  - lib/database.ts
  - lib/api-auth.ts
  - middleware.ts
  - app/api/webhooks/**
  - app/api/admin/**
  - app/api/health/**
  - lib/webhook-signature*
  - .env.example
  - '**/*secret*'
  - '**/*token*'
```

#### CR-7 — Aprovação por PR único, nunca por lote (ENFORCEMENT MECÂNICO)

- **Branch protection rule** em `main`: PRs com label `sensitive-area` exigem 1 aprovação humana explícita.
- Aprovação verbal "merge todos os pendentes" não conta. Cada PR sensível pede aprovação naquele PR.
- **Bypass de emergência:** admin GitHub pode forçar merge, com obrigação de criar PR retroativo justificando em 24h.

**Custo:** 30min (configurar labeler + branch protection).

**O que teria evitado:** ambos os incidentes 141 e 143.

#### CR-8 — `forbidden-patterns` no CI

Job novo no `ci.yml` que faz `grep` em arquivos sensíveis e falha se encontrar antipatterns conhecidos:

```bash
# ci/forbidden-patterns.sh
fail() { echo "FORBIDDEN PATTERN: $1"; exit 1; }

grep -rn "new PrismaClient(" --include="*.ts" --include="*.mjs" \
  --exclude-dir=node_modules . | grep -v "lib/prisma.ts" \
  && fail "PrismaClient instanciado fora de lib/prisma.ts (ver feedback_prisma7_client_options)"

grep -n "COPY --from=builder /app/node_modules \\.\\/node_modules" Dockerfile \
  && fail "node_modules inteiro copiado pro runner (ver project_railway_dockerfile_limits)"

# Endpoints temporários sem validação de expiração
grep -rn "app/api/admin/.*recover\|app/api/admin/.*temp" --include="*.ts" \
  | grep -v "x-expires-at" \
  && fail "Endpoint temporário sem validação de expiração (ver CR-10)"
```

**Custo:** ~30min (script + integração no CI).

**O que teria evitado:** incidente 2 (PrismaClient sem options) — direto. Futuras tentativas de copiar node_modules — direto.

#### CR-9 — Cooldown persistente pós-incidente (`.deploy-freeze`)

Após qualquer revert emergencial, criar arquivo `.deploy-freeze` no repo via PR automático com timestamp. CI bloqueia merge de PRs sensíveis se arquivo existe e idade < 24h. Remoção exige PR aprovado.

**Custo:** 20min (workflow + 5 linhas no CI).

**O que teria evitado:** incidente 2 (mergei novo PR sensível 30min após revert do anterior).

#### CR-10 — Endpoints temporários expiram automaticamente

Convenção: rotas em `app/api/admin/_temp/**` precisam de header `x-expires-at`. Helper `lib/temp-route.ts` valida data e bloqueia se vencida.

```ts
// lib/temp-route.ts
export function requireTempRouteValid(req: Request, expiresAtIso: string) {
  if (new Date() > new Date(expiresAtIso)) {
    throw new Error(`Temp route expired at ${expiresAtIso}`)
  }
}
```

**Custo:** 30min (helper + lint check).

**O que evita:** padrão dos PRs #130-#132 (tokens hardcoded esquecidos em prod).

#### CT-1 — Boot smoke test no CI

Job novo: sobe Postgres efêmero (service container), roda `prisma migrate deploy`, executa `node scripts/start.mjs`, espera ~30s, pinga `localhost:3000/api/health`, mata processo. Falha se boot não responder.

**Custo:** ~1h (YAML + tunning de timing).

**O que teria evitado:** incidente 2 direto. Incidente 1 NÃO (Postgres efêmero aplica migration sem o problema do CLI quebrado em prod) — por isso CT-7 também é necessário.

**Limitação documentada:** smoke test não substitui validação real em prod. Cobre ~30% das classes históricas.

#### CT-5 — UptimeRobot (detecção externa) [PRIORIDADE MÁXIMA]

Conta UptimeRobot (free tier), monitor pingando `https://prod-url/api/health` a cada 1min, alerta para email do stakeholder + qualquer canal extra após 2 falhas consecutivas.

**Custo:** ~15 min (criar conta + configurar URL + alerta).

**O que teria reduzido:** RTO dos dois incidentes. Hoje, detecção depende do stakeholder olhar o site. Com CT-5, alerta em ~2min independente do horário.

**Por que é P0:** controle de menor custo e maior impacto na lista. Deveria ter sido implementado **hoje**, antes de qualquer outra tentativa.

#### CT-6 — Auto-revert por healthcheck

Workflow GitHub Actions agendado (cron 1min): GET `/api/health`. Se 503 por 3min consecutivos **e** último merge < 15min: dispara `gh pr revert` no último merge automaticamente.

**Custo:** ~1h (workflow + lógica de "qual último merge" + testar com cuidado para evitar falso-positivo).

**Risco:** revert automático em flake transitório. Mitigar com 3 falhas consecutivas + janela curta após deploy.

#### CT-7 — Smoke test contra Railway preview (complementa CT-1)

Railway suporta preview environments por PR. Configurar:
1. Webhook do Railway em `pull_request_target` que cria preview
2. Job `smoke-preview` espera Railway terminar deploy → pinga `/api/health` no preview URL → falha se 503

**Custo:** ~2h (setup Railway preview + script de wait + custo financeiro Railway por preview, ~U$1-2/mês).

**O que evita:** classes que CT-1 não pega — Dockerfile mexido, deps faltando no runner image, env vars de prod, limites de plataforma.

**Importante:** CT-7 teria pegado o incidente 1 e o incidente 2 simultaneamente. **É o controle de maior impacto técnico**, mas tem custo $$ marginal.

#### CT-8 — Mudança em `start.mjs`/`Dockerfile` exige link pra ADR ou post-mortem

Check no CI: se diff toca `scripts/start.mjs` ou `Dockerfile`, corpo do PR deve conter referência a `ADR-` ou `POSTMORTEM-`. Forçar ler contexto histórico antes de tocar.

**Custo:** ~15min (script bash).

**O que evita:** próxima reescrita sem conhecer as 3 falhas anteriores.

### 6.2 — Controles AUXILIARES (boa prática; valor reduzido sem mecanização)

#### CR-2 — Template de PR (mecanizado pelo template, não pelo agente)

Em vez de "checklist comportamental", criar `.github/pull_request_template.md` com checkboxes obrigatórios. CI check separado falha se PR sensível tem checkbox vazio (parsing simples).

```markdown
## Pré-merge checklist (obrigatório se label sensitive-area)

- [ ] Li as memórias relevantes e listei abaixo o que cada uma diz
- [ ] Confirmei que migration anterior está aplicada (cole output do SELECT em _prisma_migrations)
- [ ] Boot smoke test (CT-1) passou neste PR
- [ ] Plano de revert documentado abaixo, < 5min de execução
- [ ] Riscos enumerados e mitigações
```

#### CR-3 e CR-4 — Removidos (eram comportamentais, não sobrevivem)

Substituídos pelos mecanizados acima. Reconhecidamente: pedir pro agente "consultar evidência" sem mecanismo é otimismo.

#### CR-5 — Reformulado: fail-fast exige boot smoke test passando + 1 deploy validado dentro do mesmo PR

Eliminado o esquema "warning depois exit em PR separado" (vira dívida técnica permanente). Substituído por: PR com fail-fast novo só pode ser mergeado se CT-1 + CT-7 passarem **e** healthcheck da preview retornar 200.

#### CR-6 — Substituído por CR-9 (mecanizado via `.deploy-freeze`)

### 6.3 — Decisões justificadas (em vez de descartadas por intuição)

#### Staging environment dedicado

**Antes (v1):** descartei como "canhão pra mosca".

**Depois (revisão arquiteto):** revisitar com números:
- Custo Railway preview por PR: ~U$1-2/mês (CT-7 já cobre função de staging por demanda)
- Custo de incidente: 2 reverts × 8min × atenção do stakeholder = caro

**Decisão revisada:** CT-7 (preview por PR) é o staging suficiente para este projeto. Staging permanente fica como follow-up se preview se mostrar insuficiente em 30 dias.

#### Code review humano por outro engenheiro

**Não aplicável:** equipe é "1 stakeholder + 1 LLM". Não há outro engenheiro para revisão. CT-2 (branch protection) e CR-7 (aprovação obrigatória) endereçam mecanicamente o gap, com stakeholder como aprovador único + bypass de emergência.

---

## 7. Compromissos (reformulados com honestidade)

A v1 deste post-mortem tinha "compromissos pessoais" comportamentais. **Eles não duram** — porque assistentes Claude não têm memória persistente entre sessões. Daqui a 2 semanas, uma nova sessão Claude pode repetir os mesmos erros porque "esqueceu" o post-mortem.

**O que efetivamente vale:**

| Tipo de compromisso | Valor | Persiste? |
|---|---|---|
| "Vou consultar memórias antes de mergear" | Frágil | ❌ — depende do agente lembrar |
| "Vou esperar você aprovar PR sensível" | Frágil | ❌ — depende do agente respeitar |
| **Branch protection bloqueando merge sem approval** | Forte | ✅ — sobrevive a troca de sessão |
| **CI check falhando em antipatterns** | Forte | ✅ — sobrevive |
| **Memória feedback declarando hard rule** | Médio | ⚠️ — agente precisa ler MEMORY.md, mas índice já é carregado automaticamente |

**Por isso a §6 inteira é mecânica.** Cada CR/CT tem mecanismo de enforcement no repo ou em GitHub settings. Os "compromissos comportamentais" agora vivem na memória do projeto como hard rules:

- `feedback_no_migrations_until_cli_fixed.md` (criado hoje)
- `feedback_prisma7_client_options.md` (criado hoje)
- Index em `MEMORY.md` (carregado automaticamente em toda sessão)

Vou adicionar mais 2 memórias derivadas deste post-mortem na §10.

---

## 8. Roadmap de retomada

### Fase 0 — Validação do estado atual (PENDENTE — você precisa fazer)

- [ ] **[blocker]** Confirmar visualmente que produtos e pedidos voltaram após PR #144
- [ ] **[blocker]** Rodar SQL no Railway pra verificar se canary residual ficou: `SELECT migration_name FROM _prisma_migrations WHERE migration_name LIKE '%canary%';` — se aparecer, executar `DELETE FROM _prisma_migrations WHERE migration_name = '20260529100000_migrate_action_canary';`
- [ ] **[blocker]** Confirmar que nenhum pedido foi perdido na janela de 502 (~17min totais nos dois incidentes)

### Fase 1 — Implementar Top 3 controles (BLOQUEADOR — não retoma trabalho até concluir)

| # | Item | Estimativa | Critério de pronto |
|---|---|---|---|
| 1 | CT-5 (UptimeRobot) | 15min | Recebido alerta de teste no email |
| 2 | CR-1b (labeler.yml) + CR-7 (branch protection) | ~45min | PR de teste com path sensível ganha label e exige approval |
| 3 | CR-8 (forbidden-patterns) | ~30min | CI falha em PR de teste com `new PrismaClient(` |

**Critério para fechar Fase 1:** os 3 itens em prod, validados com PR de teste sintético.

### Fase 2 — Ampliação de defesa (após Fase 1 estável por 2-3 dias)

| # | Item | Estimativa |
|---|---|---|
| 4 | CT-1 (boot smoke test no CI) | ~1h |
| 5 | CR-9 (`.deploy-freeze` automático) | ~30min |
| 6 | CR-2 (PR template) | ~15min |
| 7 | CT-8 (link pra ADR/postmortem em PR de boot) | ~15min |
| 8 | CR-10 (helper de endpoints temporários) | ~30min |

### Fase 3 — Validação completa (após Fase 2 estável por 1 semana)

| # | Item | Estimativa |
|---|---|---|
| 9 | CT-7 (Railway preview por PR) | ~2h + custo $ |
| 10 | CT-6 (auto-revert por healthcheck) | ~1h |

### Fase 4 — Retomada do trabalho técnico interrompido

**Critério para entrar:** Fase 2 completa e em prod ≥ 3 dias sem incidente.

| # | Item | Bloqueador |
|---|---|---|
| 11 | Refazer ADR-002 (migration via Action) usando `pg` direto | Fase 2 |
| 12 | Retomar SPEC-005 fase 1 (schema da loja) | ADR-002 estável em prod ≥ 1 semana |

---

## 9. Métricas de sucesso (revisar em 2026-06-13)

| Métrica | Alvo | Como medir |
|---|---|---|
| Reverts emergenciais em PRs sensíveis | **0** em 30 dias | `git log --oneline | grep -i emergencial` |
| % de PRs sensíveis com checklist preenchido | **100%** | Quantidade de label `sensitive-area` vs PRs com checklist via API GitHub |
| Tempo médio detecção → revert (RTO) | **< 5 min** | Logs UptimeRobot + commit timestamps |
| % de PRs sensíveis bloqueados por CR-8 antes do merge | tracking, sem alvo | Logs CI |
| Boot smoke test passando (após CT-1) | **> 95%** | CI history |
| Incidentes de auto-merge em PR sensível | **0** | Branch protection log |
| Janela média entre revert e próximo merge sensível | **> 60 min** após Fase 2 | `git log` analysis |

**Se em 30 dias qualquer métrica falhar:** revisitar este post-mortem, ajustar controles, escalar (incluir staging permanente, etc.).

---

## 10. Memórias derivadas deste post-mortem

(A criar após aprovação deste documento)

| Arquivo | Tipo | Conteúdo |
|---|---|---|
| `feedback_aprovacao_por_pr_unico.md` | feedback | "Aprovação por lote (`merge todos os pendentes`) é inválida para PRs sensíveis. Cada PR em path sensível exige aprovação naquele PR." |
| `feedback_evidencia_obrigatoria_pre_merge.md` | feedback | "Antes de mergear PR sensível: provar com evidência objetiva que o caminho funciona. Sem evidência, não mergear." |
| `project_postmortem_2026-05-13_doubledeploy.md` | project | Resumo deste post-mortem + link |
| `reference_arquivos_sensiveis_cr1b.md` | reference | Lista canônica de arquivos sensíveis (CR-1b) |

---

## 11. Pendências de validação

| Item | Quem | Bloqueador? |
|---|---|---|
| Site OK (admin/produtos, admin/pedidos) | Você | **Sim** — bloqueia tudo |
| Canary residual no `_prisma_migrations` | Você (SQL Railway) | Não, só limpeza |
| Pedidos perdidos na janela de 502 | Você (verificar lista) | Sim se houver |
| Aprovação dos controles propostos | Você | **Sim** — bloqueia Fase 1 |
| PR para Fase 1 (CT-5 + CR-7 + CR-8) | Eu (após sua aprovação) | — |

---

## 12. Anexos

### A. Memórias relevantes (existiam antes dos meus deploys)

| Arquivo | O que avisava | Eu ignorei? |
|---|---|---|
| `project_incident_2026-05-13.md` | Migration não aplicada + fallback localDb = pedidos perdidos | Sim (incidente 1) |
| `project_railway_dockerfile_limits.md` | Prisma CLI quebrado em prod, migrations exigem SQL manual | Sim (incidente 1) |
| `project_pr133_postmortem.md` | Hardening de startup já derrubou prod uma vez antes | Sim (incidente 2) |
| `feedback_actions_over_instructions.md` | Stakeholder valoriza ações automatizadas | Usei como justificativa pra pressa, não pra qualidade |

### B. Arquivos do projeto que mostravam o caminho certo

| Arquivo | Pattern correto | Consultei? |
|---|---|---|
| `lib/prisma.ts:15-17` | `new PrismaClient({ adapter: new PrismaPg(databaseUrl) })` | Não (incidente 2) |
| `lib/database.ts:listOrders` | Tratamento de OrderItem órfão | N/A neste caso |

### C. Sinais que o CI **não** captura hoje (CT-1 cobre)

- Se `start.mjs` executa sem crash
- Se `prisma migrate deploy` consegue conectar e aplicar migrations
- Se o app responde HTTP 200 em algum endpoint após boot
- Se boot completa em tempo razoável (não trava)

### D. Sinais que CT-1 sozinho **não** captura (CT-7 cobre)

- Limites de imagem/memória/disco do Railway
- Deps faltando no runner image (causa do incidente 1!)
- Variáveis de ambiente específicas de prod (SSL mode, connection pooling)
- Comportamento sob restart automático do Railway

### E. Revisores deste post-mortem

| Revisor | Tipo | Veredicto |
|---|---|---|
| Agente arquiteto independente | Técnico/processo | "Aceitável após 12 correções listadas" — todas incorporadas em v2 |
| Agente security-architect | Segurança/blast radius | "NO-GO sem CT-5 + CR-7 + CR-1b implementados" — explicitado em §1 |

**Decisão final fica com o stakeholder.** Recomendação dos revisores: bloquear novos PRs (não cosméticos) até Fase 1 (Top 3) em produção.

---

## Fim do documento

Próximo passo (esperando sua decisão): aprovar este post-mortem como base de trabalho, e dar OK pra eu abrir o **PR-Fase 1** com CT-5 + CR-7 + CR-1b + CR-8 (~1h de trabalho meu, ~5min de aprovação sua).
