# Padrões de código

> Convenções para que todos os PRs subsequentes sigam o mesmo desenho.

## Estrutura de pastas

```
app/
  ├ admin/                    Área administrativa (Server + Client Components)
  ├ api/                      API routes
  │   ├ admin/                Endpoints admin-only (não-CRUD)
  │   ├ auth/                 Autenticação
  │   ├ me/                   Cliente logado (a partir Fase 1)
  │   ├ webhooks/             Webhooks externos
  │   └ <recurso>/            CRUD genérico (PT para admin, EN para público)
  ├ minha-conta/              Área do cliente (Fase 1+)
  ├ meus-pedidos/             Pedidos do cliente (Fase 1)
  └ <página-pública>/         Páginas estáticas

components/                   Componentes reutilizáveis (UI)
context/                      React Contexts (Cart, Auth)
lib/
  ├ auth.ts                   Sessão server-side
  ├ auth-*.ts                 Helpers (codes, password, users, shared)
  ├ api-auth.ts               Helpers para guard de API routes
  ├ catalog.ts                Queries públicas de produtos
  ├ database.ts               CRUD admin + serializers Prisma
  ├ localDb.ts                Fallback JSON quando hasDatabase=false
  ├ mercadopago.ts            Integração MP
  ├ payment.ts                Orquestração de pagamento
  ├ shipping.ts               Integração Melhor Envio
  ├ email.ts                  Resend
  ├ validation.ts             Validações (CPF, CEP, email, phone)
  └ session-token.ts          JWT helpers

prisma/
  ├ schema.prisma
  └ migrations/<timestamp>_<nome>/migration.sql

docs/
  └ implementation/           Esta documentação
```

## Convenções de schema Prisma

- IDs sempre `String @id @default(cuid())`
- Timestamps padrão: `createdAt DateTime @default(now())` + `updatedAt DateTime @updatedAt`
- Relations: nome no singular para o lado "1" (`customer Customer?`), plural para "N" (`orders Order[]`)
- FK explícito com `@relation(fields: [xxxId], references: [id])`
- `onDelete: Cascade` apenas se faz sentido (filhos sem sentido sem o pai). Para `Order.customer`, usar `SetNull` (preserva pedido se cliente apagar conta)
- Índices em FKs frequentemente filtradas: `@@index([customerId])`

## Convenções de migration

- **Nunca** salvar `migration.sql` com BOM (UTF-8 sem assinatura). Sempre conferir com:
  ```bash
  head -c 3 prisma/migrations/<...>/migration.sql | xxd
  ```
  Se aparecer `efbbbf` no início, remover com `tail -c +4`.
- Migrations rodam no `start` script (`prisma migrate deploy && next start`) — confirmar que estão em ordem cronológica pelo timestamp do nome.
- Para alterações que envolvem dados existentes (FK nova, coluna NOT NULL com default), incluir `UPDATE` de backfill no SQL.

## Convenções de lib/database.ts

Toda função CRUD do admin deve seguir o pattern:

```ts
export async function listFoo() {
  if (!hasDatabase || !prisma?.foo) {
    return readDB().foos        // fallback localDb
  }
  try {
    const result = await prisma.foo.findMany({ ... })
    return result.map(serializeFoo)
  } catch (error) {
    console.error('[database] listFoo Prisma failed, using fallback:', error)
    return readDB().foos
  }
}
```

> ⚠️ Atenção a [lib/catalog.ts](../../lib/catalog.ts) que **não tem fallback** — para queries públicas, retornar `[]` em caso de falha (evita exposer dados do `localDb` em prod).

## Convenções de API routes

```ts
// app/api/<recurso>/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/api-auth'  // ou requireApiAdmin

export async function GET(request: NextRequest) {
  const auth = await requireApiUser()
  if (auth.response) return auth.response

  // ... lógica
  return NextResponse.json(result)
}
```

- `dynamic = 'force-dynamic'` em rotas que leem de DB (evita cache do Next)
- Sempre validar input antes de tocar no DB
- Erros padrão: 400 (input inválido), 401 (sem auth), 403 (sem permissão), 404 (não encontrado), 409 (conflito), 500 (erro interno)
- Não retornar stack trace em produção

## Convenções de componentes

- **Server Components por padrão** (sem `'use client'`)
- `'use client'` apenas quando precisar de:
  - State (`useState`, `useReducer`)
  - Effects (`useEffect`)
  - Browser APIs (`window`, `document`)
  - Event handlers de usuário
  - Context que precisa rerender
- Server Component pode importar Client Component, mas não o contrário com props não-serializáveis
- Estilização: hoje 100% inline (`style={{}}`). Manter consistente até decidir migrar para CSS Modules ou Tailwind

## Design tokens do admin (tema claro)

> **Por que isto existe:** o admin foi pintado 100% inline com uma paleta clara
> consistente. Em 2026-05-14 o PR-8a entregou a seção de Pagamentos usando
> classes Tailwind dark (`zinc-700`, `bg-zinc-900/50`, `emerald-600`), o que
> destoou completamente do resto e exigiu o retrabalho do PR [#161](https://github.com/eduardushenrique-create/BED-Site/pull/161).
> Para evitar repetir esse erro, qualquer componente novo dentro de `/admin/**`
> deve usar os tokens abaixo, **inline**, sem classes utilitárias.

### Paleta

| Função | Valor | Onde usar |
|---|---|---|
| Texto forte (títulos, valores) | `#1D2235` | h1/h2, números, sidebar bg |
| Texto muted (labels, descrições) | `#6B7494` | label de form, hint, célula secundária |
| Texto desabilitado / placeholder | `#9AA2B8` | empty-state secundário, placeholder |
| Background página | `#F0F5FB` | fundo do main, header de tabela |
| Background subtle (tile, hover) | `#FAFBFD` | empty-state, linha de lista alternada |
| Borda padrão | `#D8DCE8` | input, botão outline, divisor de card |
| Borda sutil | `#EEF1F8` | divisor entre linhas/cells |
| Brand pink (acento) | `#D4849A` | borda ativa de nav, destaque pontual |
| Success | `#0E9F6E` / bg `#DFF4EC` | pago, OK, "RETIRADA" |
| Warning | `#92400E` em bg `#FEF3C7`, borda `#F59E0B` | aviso, parcial, overflow |
| Danger | `#B42318` em bg `#FEE2E2`, borda `#EF4444` | erro, estorno, zona de perigo |
| Info | `#1D2235` em bg `#E8EEF8` | chip neutro de método |
| Blue (ação editar) | `#3B82F6` | botão "Editar Itens" |
| Purple (ação clonar) | `#8B5CF6` | botão "Clonar pedido" |
| WhatsApp | `#25D366` | botão WhatsApp |

### Componentes-padrão

**Card** (use sempre que adicionar um bloco no detalhe ou na listagem):
```ts
{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }
```
Título do card: `{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }`.

**Modal overlay**:
```ts
{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(29,34,53,0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: '16px' }
```
Conteúdo do modal: `{ backgroundColor: 'white', borderRadius: '12px', padding: '28px', maxWidth: '480px', width: '100%' }`. Fechar por Esc e por clique no overlay (guardar com `e.target === e.currentTarget` para evitar fechar ao arrastar texto).

**Input / select / textarea**:
```ts
{ width: '100%', padding: '10px 12px', borderRadius: '8px',
  border: '1px solid #D8DCE8', fontSize: '14px', backgroundColor: 'white' }
```
Label acima: `{ fontSize: '13px', fontWeight: 600, color: '#1D2235', marginBottom: '6px' }`.

**Botão primário escuro** (CTA neutro): `bg #1D2235`, texto branco, `borderRadius: '10px'`, `padding: '10px 18px'`, `fontWeight: 600`.

**Botão semântico** (verde para pagamento, vermelho para estorno/destrutivo, azul para edição neutra): mesma forma do botão escuro, trocando o `backgroundColor`. Disabled = `opacity: 0.5` + `cursor: not-allowed`.

**Tabela admin**:
- Container: `{ backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }` — **sem `overflowX: 'auto'`** quando der pra acomodar todas as colunas (preferir truncar célula variável).
- `<table>`: `{ width: '100%', borderCollapse: 'collapse' }` — **não usar `minWidth` fixo grande** (>=700px) pois força scroll lateral mesmo em telas largas.
- Cabeçalho: `<thead>` com `backgroundColor: '#F0F5FB'`, `borderBottom: '1px solid #D8DCE8'`.
- Células com texto variável (nome de cliente, email, resumo): `maxWidth` + `overflow: 'hidden'` + `textOverflow: 'ellipsis'` + `whiteSpace: 'nowrap'` + `title={valor}` (acessibilidade).

**Tipografia monoespaçada** para valores monetários e IDs: `fontFamily: 'var(--font-mono)'`. Total/Pago/Saldo, número do pedido, código de rastreamento, IP no audit log.

### Anti-padrões

- ❌ **Não importar classes Tailwind** (`bg-*`, `text-*`, `rounded-*`, `border-*`) em arquivos sob `/admin/**`. Tailwind não está configurado no projeto e mesmo se estivesse, o admin é inline-style.
- ❌ **Não criar tema escuro pontual** (`bg-zinc-900`, `bg-black`, etc.) no admin — o tema é claro do começo ao fim.
- ❌ **Não usar `minWidth` >=700px em tabela admin** sem ter validado em viewport ≥ 1280px que o conteúdo realmente precisa. Quase sempre dá pra truncar uma coluna variável e remover o `minWidth`.
- ❌ **Não inventar nova paleta** sem motivo (ex: `#2563EB` quando já tem `#3B82F6` mapeado para "ação editar"). Reusar tokens da tabela acima.

### Referências canônicas no código

Quando duvidar, abrir um destes para copiar o padrão:
- Card: `app/admin/pedidos/[id]/page.tsx` (função `Card` no fim do arquivo)
- Modal: `app/admin/pedidos/[id]/page.tsx` (showCancelModal, showDeleteModal)
- Card complexo com tiles + lista: `app/admin/pedidos/[id]/_components/OrderPaymentsSection.tsx` (PR #161)
- Modal com form completo: `app/admin/pedidos/[id]/_components/RegisterInstallmentModal.tsx` (PR #161)
- Tabela com truncamento: `app/admin/pedidos/page.tsx` e `app/admin/auditoria/page.tsx`

## Validação de dados

Todas as validações em `lib/validation.ts`:
- `validateEmail`, `validateCPF`, `validateCEP`, `formatCEP`, `formatCPF`, `formatPhone`

Server-side **sempre** revalida o que veio do client. Nunca confiar.

## Tratamento de erros

### Hoje
`console.error('[contexto] ação falhou:', error)`

### Após Fase 5
```ts
import { logger } from '@/lib/logger'
logger.error({ err: error, orderNumber }, 'order update failed')
```

## Naming

- Arquivos: `kebab-case.ts` (exceto componentes React: `PascalCase.tsx`)
- Funções: `camelCase`
- Tipos / interfaces: `PascalCase`
- Constantes: `SCREAMING_SNAKE_CASE`
- Endpoint paths: minúsculo, hífen para separar (`/api/forgot-password`, não `/api/forgotPassword`)

## Commits

- Conventional Commits: `<tipo>(<escopo>): <descrição>`
- Tipos comuns: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`
- Escopo opcional, em minúsculo
- Descrição imperativa ("add" não "added"/"adds")
- Body: explicar **por quê**, não o quê
- Footer: `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` quando aplicável

## PRs

- Título = primeira linha do commit principal
- Body com: Summary / Why / Test plan
- 1 PR = 1 mudança lógica (não misturar refactor com feature)
- Sempre rodar `tsc --noEmit` e `next build` localmente antes de abrir o PR
