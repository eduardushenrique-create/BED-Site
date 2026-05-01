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
