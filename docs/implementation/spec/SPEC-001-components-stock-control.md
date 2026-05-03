# SPEC-001 — Controle de estoque de componentes (matéria-prima)

> **Status:** Draft — aguardando aprovação do stakeholder
> **Autor:** CTO Primo Rico
> **Data:** 2026-05-03
> **Relacionado:** Módulo de produção (`ProductionTask`, `ProductionLog`), Pedidos (`Order`)

---

## 1. Contexto e problema

Hoje o sistema controla estoque do **produto final** (`Product.stock`, `ProductVariant.stockQuantity`). Mas a produção real consome **componentes/insumos** que não estão modelados:

- Luminárias precisam de **fita de LED**, fonte, soquete, etc.
- Chaveiros personalizados precisam de **TAG NFC**
- Peças impressas em geral consomem **filamento** (PLA, PETG)
- Embalagens consomem **caixa, papel kraft, fita**

Quando o admin produz uma peça, hoje ele só decrementa `Product.stock` manualmente (ou nem isso, no caso de produtos sob encomenda). Os componentes ficam invisíveis até acabar na bancada.

### Necessidades do stakeholder (transcritas)

1. Cada produto deve declarar **quais componentes** consome e em **que quantidade** por unidade produzida.
2. Admin gerencia o estoque desses componentes em tela própria.
3. **Alerta automático** quando o estoque de um componente fica abaixo de um limite mínimo.
4. **Mesmo pedidos personalizados ou sob encomenda** devem disparar alerta se faltar componente.
5. Quando uma peça é **produzida**, o estoque dos componentes correspondentes deve ser **decrementado automaticamente**.

## 2. Modelo de domínio proposto

```
Component (1) ── (N) ProductComponent (BOM) (N) ── (1) Product
                                                              │
                                                              └─ (1) ── (N) ProductVariant
                                                                                  │
ProductVariantComponent (BOM por variação, opcional)  ─────────────────────────────┘

Component (1) ── (N) StockMovement (in/out/adjust)

ProductionLog (existente) ──> dispara StockMovement quando quantityDelta > 0
```

### 2.1 Entidades novas

**`Component`** — uma matéria-prima/insumo
```
id            string @id
sku           string?  unique?  // código interno opcional
name          string            // "Fita LED 5m branco frio 12V"
description   string?
unit          string            // 'un' | 'm' | 'kg' | 'g' | 'L' | 'ml' (free-form, valido na UI)
stock         decimal           // quantidade atual em estoque
lowStockThreshold decimal?      // alerta dispara se stock <= threshold
supplier      string?           // fornecedor, texto livre
supplierUrl   string?           // link para recompra
costPerUnit   decimal?          // custo unitário (referência interna; não exibido pro cliente)
notes         string?           // observação (cor, voltagem, modelo)
isActive      boolean @default(true)
createdAt     DateTime
updatedAt     DateTime
```

**`ProductComponent`** — Bill of Materials por produto
```
id           string @id
productId    string
product      Product @relation
variantId    string?           // se preenchido, regra vale só pra essa variação
variant      ProductVariant? @relation
componentId  string
component    Component @relation
quantityPerUnit decimal         // ex.: 1 TAG NFC por chaveiro = 1; 0.045 kg PLA por peça
notes        string?            // observação ("usar só na cor preta", etc.)

@@unique([productId, variantId, componentId])
```

**`StockMovement`** — log imutável de toda movimentação de estoque
```
id           string @id
componentId  string
component    Component @relation
type         string            // 'in' (entrada), 'out' (saída prod.), 'adjust' (ajuste manual), 'reverse' (reversão)
quantity     decimal           // sempre positivo; sinal vem do `type`
balanceAfter decimal           // saldo do componente após este movimento (auditoria)
reason       string?           // texto livre — "Compra fornecedor X", "Produção pedido Y"
relatedTaskId string?          // se veio de ProductionLog
relatedTask  ProductionTask? @relation
relatedOrderNumber string?     // pra rastrear (mesmo se task for deletada)
createdByEmail string?         // admin que registrou (null para automáticos)
createdAt    DateTime
```

### 2.2 Decisões importantes

| Decisão | Escolha | Motivo |
|---|---|---|
| BOM no nível de Product ou Variant | **Ambos** — variantId é opcional em ProductComponent | Algumas variantes consomem mais (luminária GG vs P); outras compartilham |
| Decimal para quantidade | **Sim**, `Decimal(10, 4)` | Filamento mede em gramas/quilos com decimais; TAG NFC mede em unidade inteira |
| Quando debitar do estoque | **No momento de `ProductionLog`** com `quantityDelta > 0` | Debita só pelo que foi efetivamente produzido, não pelo planejado. Reversão (debit invertido) acontece se admin ajustar `quantityDelta` pra menos |
| Alerta de baixa | E-mail + badge no admin | E-mail puxa o canal já existente; badge dá visibilidade enquanto o admin não abre o e-mail |
| Bloquear produção sem componente | **Não — só avisar** | Stakeholder quer aceitar pedidos sob encomenda mesmo sem estoque, comprando depois |
| Custo unitário | Campo opcional, só admin vê | Permite no futuro calcular custo de produção por peça, mas não é UI obrigatória agora |

## 3. Schema Prisma proposto

```prisma
model Component {
  id                String     @id @default(cuid())
  sku               String?    @unique
  name              String
  description       String?    @db.Text
  unit              String     // 'un' | 'm' | 'kg' | 'g' | 'L' | 'ml' | livre
  stock             Decimal    @default(0) @db.Decimal(12, 4)
  lowStockThreshold Decimal?   @db.Decimal(12, 4)
  supplier          String?
  supplierUrl       String?
  costPerUnit       Decimal?   @db.Decimal(10, 2)
  notes             String?    @db.Text
  isActive          Boolean    @default(true)
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt

  productLinks      ProductComponent[]
  movements         StockMovement[]

  @@index([isActive])
}

model ProductComponent {
  id              String          @id @default(cuid())
  productId       String
  product         Product         @relation(fields: [productId], references: [id], onDelete: Cascade)
  variantId       String?
  variant         ProductVariant? @relation(fields: [variantId], references: [id], onDelete: Cascade)
  componentId     String
  component       Component       @relation(fields: [componentId], references: [id], onDelete: Restrict)
  quantityPerUnit Decimal         @db.Decimal(10, 4)
  notes           String?

  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@unique([productId, variantId, componentId])
  @@index([productId])
  @@index([componentId])
}

model StockMovement {
  id                 String          @id @default(cuid())
  componentId        String
  component          Component       @relation(fields: [componentId], references: [id], onDelete: Cascade)
  type               String          // 'in' | 'out' | 'adjust' | 'reverse'
  quantity           Decimal         @db.Decimal(12, 4)
  balanceAfter       Decimal         @db.Decimal(12, 4)
  reason             String?
  relatedTaskId      String?
  relatedTask        ProductionTask? @relation(fields: [relatedTaskId], references: [id], onDelete: SetNull)
  relatedOrderNumber String?
  createdByEmail     String?
  createdAt          DateTime        @default(now())

  @@index([componentId, createdAt])
  @@index([type])
  @@index([relatedOrderNumber])
}
```

> **Backwards-compat:** `Product` e `ProductVariant` ganham `productComponents ProductComponent[]`. Nada nas tabelas existentes é alterado — apenas relations adicionadas.

## 4. Endpoints planejados

### Admin — componentes
- `GET    /api/componentes` — lista com filtros (search, isActive, lowStock=true)
- `POST   /api/componentes` — criar
- `GET    /api/componentes/[id]` — detalhe + histórico de movimentações + produtos que dependem
- `PUT    /api/componentes/[id]` — atualizar metadados (não mexe em estoque)
- `DELETE /api/componentes/[id]` — só se não tem `ProductComponent` apontando; senão 409
- `POST   /api/componentes/[id]/movimento` — entrada/ajuste manual `{ type, quantity, reason }`

### Admin — BOM por produto
- `GET    /api/produtos/[id]/componentes` — lista BOM
- `POST   /api/produtos/[id]/componentes` — adicionar `{ componentId, quantityPerUnit, variantId? }`
- `PUT    /api/produtos/[id]/componentes/[bomId]` — alterar quantityPerUnit ou notes
- `DELETE /api/produtos/[id]/componentes/[bomId]` — remover

### Admin — relatórios
- `GET /api/componentes/baixa` — componentes com `stock <= lowStockThreshold` (alimenta badge no menu admin)
- `GET /api/componentes/historico?componentId=X` — histórico de movimentações com paginação
- `GET /api/componentes/cobertura?productId=X&quantity=N` — calcula se há estoque pra produzir N unidades; usado quando admin cria pedido manual

## 5. Regras de negócio

### 5.1 Quando debitar (caminho automático)

Hook em `lib/production.ts:appendProductionLog` (ou equivalente):

```
Quando ProductionLog é criado com quantityDelta > 0:
  → para cada item do pedido relacionado:
      → para cada ProductComponent (com variantId casando ou sem variantId):
          → criar StockMovement(type='out', quantity = quantityDelta * quantityPerUnit)
          → atualizar Component.stock -= consumo
          → se Component.stock <= lowStockThreshold E não foi alertado nas últimas 6h:
              → enviar email pro admin (template novo: low_stock_alert)

Quando ProductionLog é criado com quantityDelta < 0 (correção):
  → reverter StockMovements correspondentes (type='reverse')
```

**Idempotência:** `StockMovement.relatedTaskId` impede duplicar caso o handler rode mais de uma vez. Antes de criar, busca `findFirst({ relatedTaskId, type: 'out' })` da mesma "rodada" (timestamp).

### 5.2 Alerta proativo no checkout / criação de pedido

Quando um pedido é criado (manual no admin ou via storefront) e algum item depende de componentes:

- Calcular consumo total = `quantity` × `ProductComponent.quantityPerUnit`
- Se algum componente tem `stock - consumo_planejado < 0`:
  - **NÃO bloqueia o pedido** (stakeholder quer aceitar)
  - **Envia email pro admin** com lista de componentes faltantes e link pra repor
  - **Pin** no card do pedido em `/admin/pedidos/[id]` mostrando "⚠️ Faltam X TAG NFC, Y m de fita LED"

### 5.3 Alertas de baixa

Email transacional novo: `low_stock_alert` (entra no catálogo de templates de e-mail, editável via `/admin/emails/<slug>`).

Variáveis: `componentName`, `currentStock`, `threshold`, `supplierUrl`, `restockUrl` (link pro `/admin/componentes/[id]`).

**Throttle:** não dispara mais de 1 email por componente por 6h (campo `lastLowStockAlertAt` em Component, ou checar `StockMovement` recente). Evita spam quando a produção está consumindo em rajada.

### 5.4 Quando NÃO debitar

- Pedido cancelado / estornado: tarefas de produção viram `cancelled` mas as movimentações já registradas **NÃO são revertidas** automaticamente (o componente foi gasto). Admin pode lançar `adjust` manual se quiser repor.
- Pedido marcado `paid` mas sem produção iniciada: zero impacto em estoque.

## 6. UI Admin

### 6.1 Sidebar
Novo item: **Componentes** (entre `Produtos` e `Categorias` no menu lateral).
Badge vermelho com contador de componentes em baixa quando > 0.

### 6.2 `/admin/componentes` — lista
- Tabela com: imagem (se tiver), nome, SKU, unidade, estoque atual, threshold, status (✅ OK / ⚠️ Baixo / ❌ Zerado)
- Filtros: busca, "só em baixa", "só ativos"
- Botão "+ Novo componente"
- KPIs: total, em baixa, zerados, valor estimado em estoque (se costPerUnit setado)

### 6.3 `/admin/componentes/[id]` — detalhe
- Card de metadados (editar nome, SKU, unit, threshold, supplier, etc.)
- Card de **estoque** com saldo grande, botão "+ Lançar movimento"
- Modal de movimento: tipo (entrada / ajuste), quantidade, motivo
- Lista de **movimentações** ordenadas por data (entradas verde, saídas vermelho, com badge do tipo)
- Lista de **produtos que dependem** desse componente (com link)

### 6.4 Editor de produto — aba "Componentes"
- Nova aba/section em `/admin/produtos/[id]` (ou modal)
- Lista de componentes vinculados com input de `quantityPerUnit`
- Combo "+ Adicionar componente" (autocomplete buscando Component pelo nome/SKU)
- Toggle "Vínculo só para variação X" quando o produto tem variantes (cria `ProductComponent` com `variantId` setado)
- Painel lateral mostrando "Cobertura atual": com o estoque de hoje, dá pra produzir N unidades (calculado pelo menor `floor(stock / quantityPerUnit)` entre os componentes)

### 6.5 Página de detalhes do pedido
Bloco novo "Materiais necessários" listando o consumo planejado de componentes por item, com badge ⚠️ pros que faltarem.

## 7. Plano de implementação em fases

> Cada fase = 1 PR. Cada PR é mergeável e funcional sozinho — não quebra produção.

### Fase 1 — Modelo + CRUD básico (1 PR, ~1 dia)
- Migration: `Component` + `StockMovement` (sem BOM ainda)
- Schema + Prisma client
- API CRUD `/api/componentes` (sem BOM)
- API `/api/componentes/[id]/movimento` (entrada/ajuste manual)
- UI `/admin/componentes` (lista + criar) e `/admin/componentes/[id]` (detalhe + movimentações + lançar movimento)
- Item no menu lateral (sem badge ainda)
- AuditLog em criar/atualizar/excluir/movimentar

**Entrega:** admin pode catalogar componentes e gerenciar estoque manualmente. Sem ligação com produtos ainda.

### Fase 2 — BOM (1 PR, ~1 dia)
- Migration: `ProductComponent`
- API `/api/produtos/[id]/componentes` (CRUD da BOM)
- UI nova section/aba no editor de produto
- Painel "cobertura atual" no detalhe do componente
- AuditLog em mudanças na BOM

**Entrega:** produto declara o que consome. Ainda sem decremento automático.

### Fase 3 — Decremento automático + reversão (1 PR, ~1 dia)
- Hook em `lib/production.ts` no append de log com `quantityDelta > 0`
- Idempotência via `relatedTaskId` em `StockMovement`
- Reversão quando admin lança `quantityDelta` negativo
- Bloco "Materiais necessários" em `/admin/pedidos/[id]`

**Entrega:** estoque caminha sozinho conforme produção. Admin pode auditar todo histórico.

### Fase 4 — Alertas (1 PR, ~0.5 dia)
- Template `low_stock_alert` no catálogo de e-mails (editável via `/admin/emails`)
- Throttle de 6h por componente
- Endpoint `/api/componentes/baixa` + badge vermelho no menu lateral
- Alerta proativo na criação de pedido (quando faltar componente)

**Entrega:** admin é avisado antes de problemas chegarem na bancada.

### Fase 5 — Polimento e relatórios (1 PR, ~0.5 dia)
- Filtros avançados na lista de componentes
- KPIs no `/admin/componentes` (em baixa, valor em estoque)
- Export CSV de movimentações
- Documentação atualizada (`HANDOFF.md`, `glossary.md`, `api-catalog.md`)

**Total estimado:** 4 dias de desenvolvimento, distribuídos em 5 PRs.

## 8. Riscos e mitigações

| Risco | Severidade | Mitigação |
|---|---|---|
| Decimal arredondando errado em Prisma | Média | Usar `@db.Decimal(12, 4)` consistentemente; testes manuais com 0.045 kg |
| Race condition em decremento simultâneo | Baixa | Operação dentro de transação Prisma com `prisma.$transaction([update, create])` |
| Histórico ficar gigante (muitas movimentações) | Média | Index em `(componentId, createdAt)`; paginação no histórico; arquivamento futuro se virar problema |
| Admin esquecer de criar BOM em produto novo | Alta | Banner amarelo no detalhe do produto: "Este produto não tem componentes vinculados — produção não vai debitar estoque" |
| Componente removido em uso | Média | `onDelete: Restrict` em `ProductComponent`. Admin precisa remover BOM antes |
| Stakeholder não preencher `lowStockThreshold` | Baixa | Default sugerido na UI = 20% do `stock` atual ao criar; alerta só dispara se threshold preenchido |

## 9. Fora de escopo (futuro)

- **Custo de produção calculado** (componentes × costPerUnit + tempo × custo/h) — fica pra versão 2 quando tiver mais maturidade
- **Compras automatizadas** (gerar PO, integrar com fornecedor) — esforço alto, ROI baixo no curto prazo
- **Multi-armazém** (estoque em N localizações) — não é necessário enquanto for um único ponto de produção
- **Reservar estoque ao receber pedido** (vs debitar na produção) — escolhemos o caminho mais simples; reserva pode ser adicionada depois sem quebrar dados
- **Lotes / FIFO / validade** — não há necessidade no negócio atual (componentes são duráveis)

## 10. Perguntas em aberto pro stakeholder

1. **Unidade padrão** — você prefere "un, m, kg, g, L, ml" como combo fixo ou texto livre? (recomendo combo + opção "Outro" texto livre)
2. **lowStockThreshold padrão** — default = 20% do estoque inicial? Ou sempre exigir do admin no cadastro?
3. **Custo unitário** — você quer ver agora? (recomendo começar sem; adicionar como opcional)
4. **E-mail de baixa** — vai pro mesmo `eduardus.henrique@gmail.com` configurado em `RESEND_REPLY_TO_EMAIL` ou tem outro destinatário operacional?
5. **Frequência do alerta proativo no checkout** — só dispara o e-mail (1 por evento) ou também notifica em tempo real no painel? (recomendo só e-mail + badge no card)
6. **Bloqueio total** — ainda mantemos "nunca bloquear, só avisar"? Ou em algum cenário o pedido deve ser recusado se faltar componente? (sob encomenda foi explicitamente liberado por você)

---

**Após aprovar esta spec**, abro o PR da Fase 1 (modelo + CRUD básico) e seguimos.
