# Branch protection setup — passo a passo (manual, 1×)

> Documento de operação. Siga uma vez, depois nunca mais.
>
> Origem: ADR-003 v2 §G2 / CR-7 do post-mortem 2026-05-13.

## Objetivo

Bloquear merge em `main` de PRs que tocam **arquivos sensíveis** (definidos em `.github/labeler.yml`) sem aprovação humana explícita. Hoje qualquer PR pode ser auto-mergeado pelo agente Claude — depois do que aconteceu em 2026-05-13 (3 deploys quebrando prod), isso precisa virar fail-closed.

## Pré-requisito

- PR que cria `.github/labeler.yml` + `.github/workflows/labeler.yml` foi mergeado.
- Label `sensitive-area` existe no repo (criado via `gh label create`).

## Passos

### 1. Acessar Branch Protection Rules

1. Abrir https://github.com/eduardushenrique-create/BED-Site
2. Clicar em **Settings** (barra superior do repo, à direita)
3. Menu lateral esquerdo: **Branches**
4. Em "Branch protection rules", clicar **Add classic branch protection rule** (ou **Add rule** dependendo da UI atual)

### 2. Configurar a regra para `main`

Preencher exatamente:

| Campo | Valor |
|---|---|
| **Branch name pattern** | `main` |
| **Require a pull request before merging** | ✅ marcar |
| → **Require approvals** | ✅ marcar, deixar `1` |
| → **Dismiss stale pull request approvals when new commits are pushed** | ✅ marcar (segurança extra) |
| → **Require review from Code Owners** | ❌ NÃO marcar (não há CODEOWNERS configurado) |
| **Require status checks to pass before merging** | ✅ marcar |
| → **Require branches to be up to date before merging** | ✅ marcar |
| → Status checks (campo de busca) | adicionar `CI / Lint + Typecheck + Build` (deve aparecer no dropdown se algum CI já rodou recentemente) |
| **Require conversation resolution before merging** | ❌ opcional |
| **Require signed commits** | ❌ opcional (sem GPG configurado) |
| **Require linear history** | ❌ NÃO marcar (squash merges quebram isso) |
| **Require deployments to succeed before merging** | ❌ NÃO marcar (Railway é independente) |
| **Lock branch** | ❌ NÃO marcar (precisamos mergear) |
| **Do not allow bypassing the above settings** | ❌ NÃO marcar — você precisa poder bypassar em emergência |
| **Restrict who can push to matching branches** | ❌ NÃO marcar (mesmo motivo) |
| **Allow force pushes** | ❌ NÃO marcar |
| **Allow deletions** | ❌ NÃO marcar |

### 3. Salvar

Clicar em **Create** (ou **Save changes**) no rodapé.

## Validação

Após aplicar:

1. Tentar mergear este próprio PR (que adiciona o labeler) — vai funcionar porque ele **não toca** arquivos sensíveis (só docs e config do labeler).
2. Eu (Claude) vou abrir um PR-3 logo em seguida que toca `.github/workflows/ci.yml` (sensível). Esse PR vai aparecer com **label `sensitive-area`** automaticamente, e o botão "Merge" vai exigir sua aprovação.

## Bypass de emergência (se algum dia precisar)

Você é admin do repo, então sempre pode:
1. **Merge mesmo sem aprovação:** botão "Merge without waiting for requirements" (aparece em vermelho/laranja). Use APENAS em incidentes (revert urgente). Documenta retroativamente em PR/issue.
2. **Desativar temporariamente a regra:** Settings → Branches → editar → desmarcar "Do not allow bypassing".

## Como saber se está funcionando

- Em qualquer PR novo, dentro de ~30s deve aparecer o label `sensitive-area` (ou não, se for cosmético).
- Se for label `sensitive-area`, o painel do PR mostra: "Review required - At least 1 approving review is required by reviewers with write access".
- Botão "Squash and merge" fica desabilitado até você aprovar.

## Reverter setup (se quiser)

Settings → Branches → clicar nos 3 pontinhos da rule do `main` → **Delete**.

Isso volta ao estado pré-PR-2 (qualquer PR mergeável sem aprovação).
