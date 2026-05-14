# SPEC-007 — Orçamentos (Calculadora de Precificação) + Pedidos Manuais v2

> Versão: 1.0 | Data: 2026-05-14 | Status: **Draft — aguardando aprovação do stakeholder**
>
> **Autor:** CTO virtual + Arquiteto (baseado em proposta inicial revisada do stakeholder).
>
> **Relacionado:**
> - SPEC-001 (Componentes/insumos) — `Component`, `ProductComponent`, `StockMovement`
> - SPEC-002 (Variantes e produtos internos) — `Product.visibility`
> - SPEC-005 (Edição/exclusão de produção + pagamentos parciais) — `Order.createdVia`, `paidAmount/dueAmount`
> - ADR-003 v2 (Safety review da SPEC-005) — gates de migration, transação com `SELECT ... FOR UPDATE`

---

## 0. Status de entrega

| Fase | PRs previstos | Em prod |
|---|---|---|
| Fase 0 — SPEC aprovada | n/a | ⏳ aguardando aprovação |
| Fase 1 — Schema (migration única) | PR-1 | ⏳ |
| Fase 2a — API calculadora (`/api/orcamentos`, `/api/admin/pricing-settings`) | PR-2a | ⏳ |
| Fase 2b — API pedido manual (`POST /api/admin/orders`) | PR-2b | ⏳ |
| Fase 3a1 — UI `/admin/orcamentos` (Modo 2 — calculadora avulsa) | PR-3a1 | ⏳ |
| Fase 3a2 — UI `/admin/produtos/[id]/precificacao` (Modo 1 — produto) | PR-3a2 | ⏳ |
| Fase 3a3 — UI `/admin/configuracoes/precificacao` | PR-3a3 | ⏳ |
| Fase 3b — Extensão modal "Novo Pedido" (itens personalizados) | PR-3b | ⏳ |
| Fase 4 — Ponte: converter orçamento em pedido manual | PR-4 | ⏳ |

**Decisões do stakeholder (sessão de desenho — 2026-05-14):**
1. **Ordem:** F1 (calculadora) e F2 (pedidos manuais) em **paralelo**.
2. **Uploads de arquivos de referência em item personalizado:** **Não no MVP.** Apenas texto livre (`description` + `productionNotesItem`). Uploads ficam para v2.
3. **Margem sugerida por faixa de custo:** **Editável** em `PricingSettings.marginTiersJson` (admin ajusta sem deploy).
4. **Separação calculadora produto vs orçamento avulso:** Parâmetros de custo de produto de catálogo vivem **dentro de `Product`** (já existem). Orçamentos avulsos vivem em tabela **separada** (`PricingEstimate`) para não poluir o catálogo.

**Cortado do escopo (vai para SPEC-008 futura):**
- Upload de arquivos de referência (foto/PDF/STL) em item personalizado.
- Benchmark de mercado (Mercado Livre/Shopee) para sugestão de preço.
- Conversão de orçamento em **produto novo do catálogo** (hoje só converte em pedido manual).
- Envio do orçamento por e-mail/WhatsApp para o cliente aprovar online.

---

## 1. Resumo executivo (linguagem do dono do negócio)

Hoje o admin tem duas dores que se misturam:

**Dor 1 — Calcular preço de uma peça é manual.** O stakeholder usa uma planilha Excel para cada orçamento ou produto novo: anota gramas de filamento, horas de impressão, energia, depreciação da impressora, taxa de erro, componentes adicionais (LED, TAG, embalagem). A planilha calcula custo total + margem + valor de venda. Esse fluxo está **fora do sistema** — não tem histórico, não conversa com o estoque de componentes (SPEC-001) nem com o cadastro de filamentos.

**Dor 2 — Pedidos que vêm fora do site não cabem no fluxo.** Encomendas por WhatsApp, Instagram, indicação ou presencial precisam ser registradas, mas hoje o admin é forçado a:
- criar um produto fake (polui catálogo) ou
- usar um produto genérico com preço sobrescrito (distorce relatórios) ou
- não registrar no sistema (perde rastreabilidade).

Esta SPEC propõe **três coisas que conversam entre si**:

1. **Calculadora de produto** (Modo 1): para itens de catálogo, mostra o custo e sugere preço de venda. Atualiza `Product.price` quando o admin aprova. **Os campos já existem no schema** (`Product.printingMinutes`, `markupPercent`, `errorRatePercent`, `printerForCostId`) — falta a UI e a lógica de cálculo.

2. **Calculadora de orçamento avulso** (Modo 2): substitui a planilha Excel. Tabela própria `PricingEstimate` com histórico de orçamentos. Pode estar ligada a um produto (recotação) ou ser totalmente avulsa (encomenda nova). **Nunca polui o catálogo.**

3. **Pedidos manuais v2** (extensão SPEC-005): completa o `createdVia='admin'` já entregue, adicionando granularidade de canal (WhatsApp, Instagram, indicação...), notas internas e — principalmente — **item personalizado avulso sem `productId`**, para encomendas totalmente customizadas.

**O que o admin ganha:**
- Substitui a planilha do Excel por uma tela que já conhece o cadastro de filamentos, componentes e impressoras.
- Calcula custo real (com tarifa de energia e depreciação da impressora específica, se cadastrada).
- Histórico de todos os orçamentos feitos, com cliente e status (rascunho, enviado, aprovado, convertido em pedido).
- Um clique para converter um orçamento aprovado em pedido manual já com tudo preenchido.
- Pode criar pedido com item personalizado sem precisar cadastrar produto fake.
- Filtro por canal de origem (WhatsApp, indicação, presencial...) na listagem de pedidos.

**O que o cliente final vê:** nada novo. Orçamentos e pedidos manuais continuam sendo fluxo interno do admin — não aparecem no site nem em `/minha-conta` (regra de SPEC-005).

---

## 2. Estado atual confirmado

### 2.1 O que JÁ EXISTE e será reaproveitado

| Domínio | Modelo / campo | Local | Cobertura |
|---|---|---|---|
| Filamentos cadastrados | `Filament` (`name`, `brand`, `type`, `pricePerKg`, `colorHex`, `isActive`) | [prisma/schema.prisma:675](../../../prisma/schema.prisma) | 100% — não criar tabela nova |
| Componentes (LED, TAG, embalagem, etc.) | `Component` (`name`, `unit`, `costPerUnit`, `stock`, `isActive`) | [prisma/schema.prisma:608](../../../prisma/schema.prisma) | 100% — usar dropdown |
| Impressoras | `Printer` (`powerConsumptionWatts`, `acquisitionCostBRL`, `lifetimeHours`) | [prisma/schema.prisma:403](../../../prisma/schema.prisma) | 100% — energia e depreciação derivadas |
| BOM de produto (filamento) | `ProductFilament.grams` | [prisma/schema.prisma:694](../../../prisma/schema.prisma) | Usado no Modo 1 |
| BOM de produto (componentes) | `ProductComponent.quantityPerUnit` | [prisma/schema.prisma:632](../../../prisma/schema.prisma) | Usado no Modo 1 |
| Tempo de impressão do produto | `Product.printingMinutes` | [prisma/schema.prisma:54](../../../prisma/schema.prisma) | Usado no Modo 1 |
| Margem do produto | `Product.markupPercent` | [prisma/schema.prisma:55](../../../prisma/schema.prisma) | Usado no Modo 1 |
| Taxa de erro do produto | `Product.errorRatePercent` (default 30%) | [prisma/schema.prisma:56](../../../prisma/schema.prisma) | **Bate com a planilha do stakeholder (30%)** |
| Impressora vinculada ao produto | `Product.printerForCostId` | [prisma/schema.prisma:52](../../../prisma/schema.prisma) | Usado no Modo 1 |
| Despesas operacionais | `CompanyExpense` (com `relatedFilamentId`/`relatedComponentId`/`relatedPrinterId`) | [prisma/schema.prisma:769](../../../prisma/schema.prisma) | Não tocar |
| Origem do pedido (granularidade básica) | `Order.createdVia` (`'site'` \| `'admin'`) | [prisma/schema.prisma:226](../../../prisma/schema.prisma) | Mantém — granularidade fina vem em `manualChannel` |
| Cliente opcional em pedido | `Order.customerId` (`String?`) + campos inline (`customerName`/`Email`/`Phone`/`Cpf`) | [prisma/schema.prisma:189-192, 238](../../../prisma/schema.prisma) | 100% — SPEC-005 já consolidou |
| Snapshot em itens | `OrderItem.productNameSnapshot`, `skuSnapshot`, `personalizationJson` | [prisma/schema.prisma:264-269](../../../prisma/schema.prisma) | 100% — só precisa relaxar `productId` |
| Pagamento parcial | `Order.paidAmount`, `dueAmount`, `PaymentInstallment` | SPEC-005 entregue (PRs #156-#161) | Usado no Modo 2 quando orçamento vira pedido com sinal |
| Auditoria | `AuditLog` | [app/api/admin/audit-log/route.ts](../../../app/api/admin/audit-log/route.ts) | **Reusar — não criar `OrderAuditLog` paralelo** |
| Filtro `createdVia` em `/minha-conta` | Já entregue (PR #160) | — | Orçamentos avulsos nem chegam lá |

### 2.2 Lacunas reais (que esta SPEC fecha)

| Lacuna | Solução proposta |
|---|---|
| Não há tabela `PricingSettings` (parâmetros globais: energia, depreciação default, taxa erro default, faixas de margem). | Criar `PricingSettings` (singleton, 1 linha). |
| Não há histórico de orçamentos (planilha Excel paralela). | Criar `PricingEstimate` separado de `Product`. |
| Granularidade de canal dentro de `createdVia='admin'` (WhatsApp vs Instagram vs indicação...). | Adicionar `Order.manualChannel String?`. |
| Quem indicou o pedido. | Adicionar `Order.referredBy String?`. |
| Nota livre do atendimento, separada de `currentStageNote` (estado da produção). | Adicionar `Order.internalNotes String?`. |
| Quem criou o pedido manual (auditoria). | Adicionar `Order.createdByAdminId String?`. |
| `OrderItem.productId` é obrigatório — não permite item totalmente personalizado. | Tornar `String?` + adicionar `itemType` discriminador. |
| Não há descrição livre nem notas por item. | Adicionar `OrderItem.description` e `OrderItem.productionNotesItem`. |
| Não há indicador "preço foi sobrescrito pelo admin" (auditoria). | Adicionar `OrderItem.priceOverridden Boolean`. |
| Ponte entre orçamento e pedido manual. | Adicionar `OrderItem.estimateId String?` (FK para `PricingEstimate`). |

### 2.3 Anti-padrões a evitar (lições do projeto)

- ❌ **Não trocar `paymentStatus`/`fulfillmentStatus` de `String` para enum Prisma.** Alto risco; SPEC-005 já consolidou pipeline de 10 estados em [lib/order-statuses.ts](../../../lib/order-statuses.ts). Adicionar valor novo (se preciso) é só literal de tipo.
- ❌ **Não criar `OrderSource` enum com SITE/WHATSAPP/INSTAGRAM/...** `createdVia` é o discriminador (site vs admin). Granularidade fina entra em `manualChannel` String.
- ❌ **Não criar `OrderAuditLog` paralelo.** Reusar `AuditLog` existente.
- ❌ **Não criar `FilamentType` paralelo.** `Filament` já cobre.
- ❌ **Não duplicar campos de custo em `PricingEstimate` quando vinculada a produto** — **congelar snapshot** (`filamentPricePerKgSnapshot`, `energyCostPerHourSnapshot` etc.) para reproduzir cálculo no futuro mesmo se cadastro mudar.
- ❌ **Não usar Tailwind nem tema escuro em `/admin/**`** — paleta documentada em [coding-standards.md:117-197](../coding-standards.md). Referências canônicas: `OrderPaymentsSection.tsx`, `RegisterInstallmentModal.tsx`.
- ❌ **Não dividir o schema em múltiplas migrations** — uma única migration consolidando os deltas das três features. Reduz risco com Prisma CLI em prod.

---

## 3. Decisões arquiteturais

### 3.1 Feature A — Calculadora de orçamento avulso (Modo 2)

#### 3.1.1 Modelo de dados

**Decisão:** Tabela `PricingEstimate` **separada de `Product`**, com `productId` opcional. Snapshots de todos os parâmetros que afetam o cálculo.

```prisma
model PricingEstimate {
  id          String   @id @default(cuid())

  // Identificação humana — substitui o nome da linha da planilha Excel
  name        String   // "Orçamento Fernando - Círculo Dardo"

  // Status do orçamento
  // 'draft'     — em construção, não enviado
  // 'sent'      — admin marcou como enviado ao cliente (controle interno)
  // 'approved'  — cliente aprovou (controle interno; não muda nada no sistema)
  // 'rejected'  — cliente rejeitou
  // 'converted' — virou Pedido (convertedToOrderId preenchido)
  status      String   @default("draft")

  // Vínculo opcional com produto (recotação de item de catálogo).
  // Quando NULL: orçamento totalmente avulso (encomenda nova).
  productId   String?
  product     Product? @relation(fields: [productId], references: [id], onDelete: SetNull)

  // Cliente — sempre opcional, sempre texto livre (consistente com Order
  // criado via createdVia='admin'). Não vincular a Customer aqui — orçamento
  // pode existir sem cliente cadastrado ainda.
  customerName  String?
  customerPhone String?
  customerEmail String?
  notes         String?  @db.Text

  // ─── INPUTS DA CALCULADORA ───────────────────────────────────────────

  quantity      Int      @default(1)

  // Filamento — FK opcional; quando NULL, admin digita custo manual em filamentPricePerKgSnapshot
  filamentId    String?
  filament      Filament? @relation(fields: [filamentId], references: [id], onDelete: SetNull)
  filamentGrams Decimal   @db.Decimal(10, 2)
  printHours    Decimal   @db.Decimal(10, 2)

  // Impressora — FK opcional; quando NULL usa defaults de PricingSettings
  printerId     String?
  printer       Printer?  @relation(fields: [printerId], references: [id], onDelete: SetNull)

  // Componentes escolhidos — JSON para preservar snapshot histórico mesmo se
  // Component for editado/desativado depois. Estrutura:
  // [{ componentId, name, unit, qty, unitCostSnapshot, total }]
  componentsJson Json    @default("[]")

  // ─── SNAPSHOTS DOS PARÂMETROS APLICADOS ──────────────────────────────
  // Congelam o cenário do momento do cálculo. Permitem reproduzir o resultado
  // mesmo que Filament.pricePerKg, PricingSettings ou Printer mudem depois.

  filamentPricePerKgSnapshot    Decimal  @db.Decimal(10, 2)
  energyCostPerHourSnapshot     Decimal  @db.Decimal(10, 4)
  depreciationPerHourSnapshot   Decimal  @db.Decimal(10, 4)
  errorRate                     Decimal  @db.Decimal(5, 4)   // ex.: 0.30 = 30%
  marginPercent                 Decimal  @db.Decimal(5, 4)   // ex.: 0.60 = 60%

  // ─── RESULTADOS CONGELADOS ───────────────────────────────────────────

  costFilament     Decimal  @db.Decimal(10, 2)
  costEnergy       Decimal  @db.Decimal(10, 2)
  costDepreciation Decimal  @db.Decimal(10, 2)
  costError        Decimal  @db.Decimal(10, 2)
  costComponents   Decimal  @db.Decimal(10, 2)
  costTotal        Decimal  @db.Decimal(10, 2)
  suggestedPrice   Decimal  @db.Decimal(10, 2)
  finalPrice       Decimal? @db.Decimal(10, 2)  // null se admin não bateu martelo no preço

  // ─── PONTE COM PEDIDO MANUAL ─────────────────────────────────────────

  convertedToOrderId String?  @unique
  convertedToOrder   Order?   @relation("EstimateOrder", fields: [convertedToOrderId], references: [id], onDelete: SetNull)
  convertedAt        DateTime?

  // ─── AUDITORIA ───────────────────────────────────────────────────────

  createdByEmail  String?
  updatedByEmail  String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([productId])
  @@index([status])
  @@index([createdAt])
  @@index([convertedToOrderId])
}
```

**Justificativa do JSON em `componentsJson`** (não tabela relacional `PricingEstimateComponent`):
- Snapshot perfeito sem replicação manual.
- Não há queries do tipo "quais estimativas usam o componente X?" no MVP.
- Reduz uma tabela e dois índices no banco.
- Se houver demanda futura (relatório de componente mais usado), refatorar.

#### 3.1.2 Endpoints

Convenção do projeto: CRUD admin em português ([coding-standards.md:15](../coding-standards.md:15)).

```
GET    /api/orcamentos
  Query: ?status=draft|sent|approved|rejected|converted
         ?productId=<id>
         ?search=<nome cliente|nome orçamento>
         ?from=<iso>&to=<iso>
         ?page=1&pageSize=20
  Response: { items: [...], total, page, pageSize }

POST   /api/orcamentos
  Body: {
    name: string,                            // obrigatório
    productId?: string,                      // opcional (recotação)
    customerName?: string,
    customerPhone?: string,
    customerEmail?: string,
    notes?: string,
    quantity: number,                        // >= 1
    filamentId?: string,                     // se NULL, exige filamentPricePerKgOverride
    filamentPricePerKgOverride?: number,     // só quando filamentId NULL
    filamentGrams: number,                   // > 0
    printHours: number,                      // > 0
    printerId?: string,                      // se NULL, usa defaults globais
    components: [{ componentId, qty }],      // pode ser vazio
    errorRateOverride?: number,              // se NULL usa defaultErrorRate
    marginPercentOverride?: number,          // se NULL usa sugestão por tier
  }
  Server: calcula custos e suggestedPrice. Persiste com snapshots.
  Response: PricingEstimate completo.

GET    /api/orcamentos/[id]
  Response: PricingEstimate completo.

PATCH  /api/orcamentos/[id]
  Body: campos a alterar (incluindo status). Se inputs mudarem, recalcula.
  Server: revalida e recalcula tudo se qualquer input numérico mudou.
  Response: PricingEstimate atualizado.

DELETE /api/orcamentos/[id]
  Soft-delete? Não. Hard-delete (orçamento ≠ pedido; sem implicação financeira).
  Apenas registra em AuditLog antes.
  Bloqueia se status='converted' (tem pedido vinculado).

POST   /api/orcamentos/[id]/converter-pedido
  Body: {
    paymentStatus?: 'pending'|'partial'|'paid',
    fulfillmentStatus?: 'pending',
    initialInstallment?: { amount, method, ... },  // opcional — entrada
    manualChannel?: 'whatsapp'|'instagram'|'indicacao'|...,
    referredBy?: string,
    internalNotes?: string,
    productionDeadline?: ISO date,
  }
  Server: cria Order (createdVia='admin') + OrderItem (itemType='custom' OU
          'catalog' conforme productId) em transação. Marca estimate.status='converted'
          e estimate.convertedToOrderId. Se initialInstallment presente, dispara
          recalculatePaidAmount (lib/installments.ts).
  Response: { orderId, orderNumber }
```

**Endpoints de cálculo "dry-run"** (para preview em tempo real na UI sem persistir):

```
POST   /api/orcamentos/calcular
  Body: mesmo payload de POST /api/orcamentos
  Server: calcula e retorna breakdown SEM persistir.
  Response: { costFilament, costEnergy, costDepreciation, costError,
              costComponents, costTotal, suggestedPrice, marginPercentApplied }
```

**Guards:**
- Todas as rotas exigem `requireApiAdmin()`.
- `POST /converter-pedido` exige `estimate.status` em `('draft', 'sent', 'approved')` — bloqueia se já convertido.
- Validação Zod no body. Server **sempre** recalcula totais — não confia no client.
- `AuditLog` em todas as mutações (`action`: `ESTIMATE_CREATED`, `ESTIMATE_UPDATED`, `ESTIMATE_CONVERTED`, `ESTIMATE_DELETED`).

#### 3.1.3 UI — `/admin/orcamentos`

**Adicionar item no sidebar** ([app/admin/layout.tsx:10-26](../../../app/admin/layout.tsx:10)):
```ts
{ href: '/admin/orcamentos', label: 'Orçamentos' }
// posicionar entre 'Despesas' e 'Avaliações' (área administrativa, não operação diária)
```

**Listagem** (`/admin/orcamentos/page.tsx`):

```
┌── Orçamentos ─────────────────────────────────────────────────────────────┐
│                                                                            │
│  [Buscar nome/cliente...]   [Status: Todos ▾]   [Período ▾]   [+ Novo]    │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │ Nome                  Cliente       Custo    Preço     Status  Data │ │
│  ├──────────────────────────────────────────────────────────────────────┤ │
│  │ Fernando — Círculo    Fernando      81,95   147,51    Rascunho 14/05│ │
│  │ Porta Figurinha Duplo Ana Paula     20,65    30,98    Aprovado 13/05│ │
│  │ Topo de bolo jardim   Beatriz      120,00   240,00    Convertido ↗  │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

- Tabela segue padrão [coding-standards.md:174-180](../coding-standards.md:174) — header `#F0F5FB`, sem `minWidth` fixo, truncamento com `title` em coluna "Nome".
- Valores monetários em `var(--font-mono)`.
- Status como chip colorido (paleta semântica documentada): Rascunho cinza, Enviado info azul, Aprovado verde, Rejeitado vermelho, Convertido com seta link para o pedido.
- Botão `+ Novo` abre a tela de criação em `/admin/orcamentos/novo`. **Não usar modal** — formulário é grande demais.

**Criação/edição** (`/admin/orcamentos/novo` e `/admin/orcamentos/[id]`):

```
┌── Novo orçamento ─────────────────────────────────────────────────────────┐
│                                                                            │
│  ┌── Identificação ──────────────────────────────────────────────────┐    │
│  │ Nome do orçamento*                                                │    │
│  │ [Fernando — Círculo Dardo_______________________________________] │    │
│  │                                                                   │    │
│  │ Status                                                            │    │
│  │ [Rascunho ▾]                                                      │    │
│  │                                                                   │    │
│  │ Vincular a produto do catálogo (opcional)                         │    │
│  │ [Buscar produto... 🔍] [Limpar]                                   │    │
│  │ ℹ Vincular auto-preenche filamento, gramas, horas e componentes  │    │
│  │   a partir da ficha do produto.                                   │    │
│  └───────────────────────────────────────────────────────────────────┘    │
│                                                                            │
│  ┌── Cliente (opcional) ─────────────────────────────────────────────┐    │
│  │ Nome           [Fernando____________________________]             │    │
│  │ Telefone       [(11) 99999-9999______]                            │    │
│  │ E-mail         [____________________________________]             │    │
│  │ Observações    [Cliente indicado pela Beatriz, paga só no pix__]  │    │
│  └───────────────────────────────────────────────────────────────────┘    │
│                                                                            │
│  ┌── Impressão ──────────────────────────────────────────────────────┐    │
│  │ Quantidade*           [1__]                                       │    │
│  │ Filamento*            [PLA Genérico — 105,90/kg ▾]                │    │
│  │ Gramas*               [300______]   Horas*  [9.0_____]            │    │
│  │ Impressora            [Ender 3 V2 ▾]  (opcional — usa defaults)   │    │
│  └───────────────────────────────────────────────────────────────────┘    │
│                                                                            │
│  ┌── Componentes adicionais ─────────────────────────────────────────┐    │
│  │ [+ Adicionar componente]                                          │    │
│  │                                                                   │    │
│  │ • Fita LED 5m branco frio    Qtd [1]   R$ 25,00     [×]          │    │
│  │ • Embalagem caixa M          Qtd [1]   R$  3,50     [×]          │    │
│  └───────────────────────────────────────────────────────────────────┘    │
│                                                                            │
│  ┌── Cálculo ────────────────────────────────────────────────────────┐    │
│  │ Custo filamento (300g × 0,1059)            R$ 31,77               │    │
│  │ Custo energia (9h × R$ 0,35)               R$  3,15               │    │
│  │ Depreciação (9h × R$ 1,00)                 R$  9,00               │    │
│  │ Taxa de erro (30% × filamento)             R$  9,53               │    │
│  │ Componentes (LED + embalagem)              R$ 28,50               │    │
│  │ ─────────────────────────────────────────────────                │    │
│  │ Custo total                                R$ 81,95  ← monoespaço │    │
│  │                                                                   │    │
│  │ Margem sugerida (R$ 40-100 → 50%)          [50%_____]             │    │
│  │ ✏ Editar  ↻ Restaurar sugestão                                    │    │
│  │                                                                   │    │
│  │ Preço sugerido                             R$ 122,93              │    │
│  │ Preço final ao cliente                     [R$ 130,00___]         │    │
│  │ ℹ Sobrescrever o preço sugerido fica registrado no histórico.    │    │
│  └───────────────────────────────────────────────────────────────────┘    │
│                                                                            │
│  [Salvar rascunho]   [Salvar e enviar]   [Converter em pedido →]          │
└────────────────────────────────────────────────────────────────────────────┘
```

- Layout em colunas únicas (uma coluna larga, máximo `maxWidth: '900px'`, centralizado), por consistência com o formulário de despesas (`/admin/despesas/nova`).
- **Cálculo em tempo real:** debounce de 300ms a cada mudança de input numérico → chama `POST /api/orcamentos/calcular` (dry-run) e atualiza o bloco "Cálculo". UX: card de cálculo nunca fica vazio enquanto outros campos estão preenchidos.
- **Conversão em pedido:** modal de confirmação que exibe o resumo do pedido que vai ser criado (item, valor, cliente) + opção de registrar entrada (1ª `PaymentInstallment`) imediatamente.
- **Estilo:** todos os cards usam `{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }` ([coding-standards.md:149](../coding-standards.md:149)). Espaçamento entre cards `gap: '16px'`.

---

### 3.2 Feature B — Calculadora de produto (Modo 1)

#### 3.2.1 Modelo de dados

**Decisão:** **Nenhuma alteração de schema.** Todos os campos necessários já existem em `Product`:

| Campo | Tipo | Já existe? |
|---|---|---|
| `Product.printingMinutes` | `Int?` | ✅ [schema.prisma:54](../../../prisma/schema.prisma:54) |
| `Product.markupPercent` | `Decimal?` | ✅ [schema.prisma:55](../../../prisma/schema.prisma:55) |
| `Product.errorRatePercent` | `Decimal?` (default 30) | ✅ [schema.prisma:56](../../../prisma/schema.prisma:56) |
| `Product.printerForCostId` | `String?` (FK para Printer) | ✅ [schema.prisma:52](../../../prisma/schema.prisma:52) |
| `Product.price` | `Decimal` | ✅ |
| `ProductFilament[]` | relação BOM filamento | ✅ |
| `ProductComponent[]` | relação BOM componentes | ✅ |

A calculadora de produto **lê** esses campos, calcula custo, sugere preço e — quando o admin aprova — escreve em `Product.price`. **Não cria `PricingEstimate`** — gestão de catálogo não vira histórico de orçamento.

#### 3.2.2 Endpoints

```
POST   /api/produtos/[id]/precificacao/calcular
  Body: (opcional) overrides de qualquer parâmetro para "what-if":
  {
    printingMinutesOverride?: number,
    errorRatePercentOverride?: number,
    markupPercentOverride?: number,
    filamentIdOverride?: string,
    componentsOverride?: [{ componentId, qty }]
  }
  Server: lê ProductFilament + ProductComponent + Product e calcula custo
          sugerido. Não persiste.
  Response: { costFilament, costEnergy, costDepreciation, costError,
              costComponents, costTotal, suggestedPrice }

PATCH  /api/produtos/[id]/precificacao
  Body: { applyPriceUpdate: boolean, ...params }
  Server: persiste alterações em Product (printingMinutes, markupPercent,
          errorRatePercent, printerForCostId). Se applyPriceUpdate=true,
          atualiza Product.price com suggestedPrice calculado.
  Response: Product atualizado.
```

#### 3.2.3 UI — `/admin/produtos/[id]/precificacao`

Aba ou seção dentro da página de edição de produto. **Não criar rota nova de nível superior** (não vai no sidebar).

```
┌── Editar produto > Precificação ──────────────────────────────────────────┐
│                                                                            │
│  ┌── Parâmetros de produção ─────────────────────────────────────────┐    │
│  │ Impressora             [Ender 3 V2 ▾]                             │    │
│  │ Tempo de impressão     [540__ min]  (9 horas)                     │    │
│  │ Taxa de erro           [30%_]  (default da loja: 30%)             │    │
│  │ Margem desejada        [60%_]                                     │    │
│  └───────────────────────────────────────────────────────────────────┘    │
│                                                                            │
│  ┌── Filamento (do BOM) ─────────────────────────────────────────────┐    │
│  │ PLA Genérico            300g            R$ 31,77                  │    │
│  │ [Editar BOM em /admin/produtos/[id]]                              │    │
│  └───────────────────────────────────────────────────────────────────┘    │
│                                                                            │
│  ┌── Componentes (do BOM) ───────────────────────────────────────────┐    │
│  │ LED Fita 5m              1 un          R$ 25,00                   │    │
│  │ Embalagem M              1 un          R$  3,50                   │    │
│  └───────────────────────────────────────────────────────────────────┘    │
│                                                                            │
│  ┌── Custo e preço ──────────────────────────────────────────────────┐    │
│  │ Custo total              R$ 81,95                                 │    │
│  │ Preço atual              R$ 130,00                                │    │
│  │ Preço sugerido (60%)     R$ 131,12                                │    │
│  │                                                                   │    │
│  │ [Salvar parâmetros]   [Aplicar preço sugerido]                    │    │
│  └───────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────────┘
```

- Reutiliza componentes do `OrderPaymentsSection` (tiles de valor monetário) — paleta e tipografia idênticas.
- "Aplicar preço sugerido" abre modal de confirmação se a variação for >20% do preço atual (proteção contra acidente).

---

### 3.3 Feature C — Pedidos manuais v2 (delta SPEC-005)

#### 3.3.1 Modelo de dados

**Alterações em `Order` (4 colunas novas):**

```prisma
model Order {
  // ...campos existentes intactos...

  // Granularidade dentro de createdVia='admin'. NULL quando createdVia='site'.
  // Valores: 'whatsapp' | 'instagram' | 'indicacao' | 'presencial' | 'telefone' | 'outro'
  manualChannel    String?

  // Quando manualChannel='indicacao' — texto livre de quem indicou
  referredBy       String?

  // Nota livre do atendimento. Distinta de currentStageNote (estado da produção).
  internalNotes    String?  @db.Text

  // Auditoria — qual admin criou o pedido (e-mail). NULL para pedidos do site.
  createdByEmail   String?

  // Relação inversa com PricingEstimate (1:1 — um pedido pode ter vindo de um orçamento).
  fromEstimate     PricingEstimate? @relation("EstimateOrder")

  @@index([manualChannel])
}
```

**Alterações em `OrderItem` (5 campos):**

```prisma
model OrderItem {
  // ...campos existentes intactos...

  productId           String?   // ← MUDANÇA: era obrigatório, agora opcional
  product             Product?  @relation(fields: [productId], references: [id])

  // Discriminador:
  // 'catalog' — productId obrigatório, productNameSnapshot vem de Product.name
  // 'custom'  — productId pode ser null, productNameSnapshot é digitado pelo admin
  itemType            String    @default("catalog")

  // Texto livre — encomendas personalizadas
  description         String?   @db.Text

  // Notas de produção POR ITEM. Distinta de Order.internalNotes (que é do pedido).
  productionNotesItem String?   @db.Text

  // True quando unitPrice ≠ Product.price no momento da criação
  // (gestão/auditoria; calculado pelo backend, não enviado pelo client).
  priceOverridden     Boolean   @default(false)

  // Ponte com orçamento avulso
  estimateId          String?
  estimate            PricingEstimate? @relation(fields: [estimateId], references: [id], onDelete: SetNull)

  @@index([itemType])
}
```

**Regra de integridade (validada no backend, não no schema):**

```
Se OrderItem.itemType = 'catalog':
  productId obrigatório
  productNameSnapshot é copiado de Product.name (não enviado pelo client)
  skuSnapshot é copiado de Product.sku ou Variant.sku
  unitPrice pode ser overridden (gera priceOverridden=true)

Se OrderItem.itemType = 'custom':
  productId obrigatório NULL
  variantId obrigatório NULL
  productNameSnapshot é enviado pelo admin (livre)
  skuSnapshot opcional (livre)
  unitPrice obrigatório
  description recomendado
```

#### 3.3.2 Endpoints

**Novo endpoint principal:**

```
POST   /api/admin/orders
  (Endpoint admin-only para criar pedido manual. Não confundir com
   /api/pedidos que é usado tanto pelo site quanto pelo admin para CRUD geral.)

  Body: {
    // Origem
    manualChannel: 'whatsapp'|'instagram'|'indicacao'|'presencial'|'telefone'|'outro',
    referredBy?: string,

    // Cliente — formato unificado (vincula OU cria snapshot)
    customer: {
      customerId?: string,            // se preenchido, vincula
      name: string,                   // obrigatório (snapshot)
      email?: string,
      phone?: string,
      cpf?: string,
    },

    // Itens — heterogêneo, cada um com itemType
    items: Array<
      | { itemType: 'catalog',  productId: string, variantId?: string,
          quantity: number, unitPriceOverride?: number,
          personalizationJson?: any, productionNotesItem?: string,
          estimateId?: string }
      | { itemType: 'custom',   productNameSnapshot: string, skuSnapshot?: string,
          description?: string, quantity: number, unitPrice: number,
          personalizationJson?: any, productionNotesItem?: string,
          estimateId?: string }
    >,

    // Pagamento / entrega
    discountTotal?: number,
    discountReason?: string,
    shippingTotal?: number,
    shippingMethod?: string,
    deliveryMethod?: 'shipping'|'pickup',
    orderType?: 'sob_encomenda'|'pronta_entrega',
    paymentStatus?: 'pending'|'partial'|'paid',
    initialInstallment?: {            // opcional — entrada
      amount: number, method: string, description?: string,
      receivedAt?: ISO, notes?: string
    },
    fulfillmentStatus?: 'pending'|'aguardando_producao',
    productionDeadline?: ISO,
    expectedDeliveryAt?: ISO,

    // Notas
    internalNotes?: string,
    notes?: string,                   // observação do cliente (visível em /minha-conta se fosse 'site', mas não é)
  }

  Server:
    1. requireApiAdmin()
    2. Zod valida payload
    3. Para cada item:
       - Se itemType='catalog': busca Product, valida que existe, copia
         productNameSnapshot e skuSnapshot, calcula priceOverridden
       - Se itemType='custom': valida que productNameSnapshot e unitPrice
         vieram, productId/variantId forçados a null
    4. Calcula subtotal, total no servidor (NUNCA confia no client)
    5. Em transação:
       - cria Order com createdVia='admin'
       - cria OrderItems
       - se initialInstallment: chama recalculatePaidAmount() (lib/installments.ts)
       - registra AuditLog action='ORDER_CREATED_MANUALLY'
       - se algum item tem estimateId: marca PricingEstimate.status='converted',
         convertedToOrderId=order.id, convertedAt=now()
    6. Retorna Order completo

  Response: { id, orderNumber, total, paymentStatus, fulfillmentStatus, items }
```

**Reutilização de endpoints existentes:**
- `PATCH /api/pedidos/[id]` — edição (já existe, suporta os campos novos sem mudança quando frontend os passar)
- `POST /api/pedidos/[id]/installments` — pagamento parcial (SPEC-005, já em prod)
- `DELETE /api/producao/[id]` — exclusão (SPEC-005, já em prod)

#### 3.3.3 UI — extensão do modal "Novo Pedido"

Hoje [app/admin/pedidos/page.tsx](../../../app/admin/pedidos/page.tsx) tem botão "Novo Pedido" que abre modal. **Estender** este modal (não criar fluxo novo) com:

1. **Bloco "Origem" no topo** (visível apenas quando `createdVia` é implicitamente 'admin'):
   ```
   Canal*                  [WhatsApp ▾]
   Quem indicou (opcional) [Beatriz_____________]
   ```

2. **Toggle por item: catálogo / personalizado:**
   ```
   ┌── Item 1 ─────────────────────────────────────────────────────────┐
   │  ◉ Produto do catálogo    ○ Item personalizado                   │
   │                                                                   │
   │  Produto*  [Buscar... 🔍]   Variação  [P ▾]                       │
   │  Qtd*  [1]   Preço unitário  [R$ 130,00] (sugerido: R$ 130,00)    │
   │  Notas de produção  [______________________________]              │
   └───────────────────────────────────────────────────────────────────┘
   
   Quando "Item personalizado":
   ┌── Item 2 ─────────────────────────────────────────────────────────┐
   │  ○ Produto do catálogo    ◉ Item personalizado                   │
   │                                                                   │
   │  Nome do item*       [Topo de bolo jardim encantado_____________] │
   │  Descrição           [Tema jardim, tons pastel, nomes Ana+Pedro] │
   │  Qtd*  [1]   Preço unitário*  [R$ 120,00]                         │
   │  Notas de produção  [Usar PLA branco, pintura manual____________] │
   └───────────────────────────────────────────────────────────────────┘
   ```

3. **Bloco "Notas internas":**
   ```
   Notas internas do pedido (não aparecem ao cliente):
   [Cliente indicado pela Beatriz. Combinou retirar dia 20.____________]
   ```

4. **Bloco "Pagamento inicial" (opcional):**
   ```
   ☐ Registrar entrada agora
     (quando marcado, expande para os campos de PaymentInstallment)
   ```

- **Reutilizar:** modal já existe, este PR é um **delta de UI**. Aproveita o componente `RegisterInstallmentModal` ([referência canônica](../coding-standards.md:194)) embutido como sub-bloco quando "Registrar entrada agora" é marcado.
- **Atalho de criação rápida:** botão na listagem `/admin/orcamentos` chamado "→ Converter em pedido" leva ao mesmo modal pré-preenchido com os dados do orçamento.

#### 3.3.4 Filtros e listagem de pedidos

Em `/admin/pedidos`:
- Novo filtro `Canal: Todos | Site | WhatsApp | Instagram | Indicação | Presencial | Telefone | Outro` (combina `createdVia` + `manualChannel`).
- Coluna "Canal" como chip discreto.
- Pedidos com `itemType='custom'` mostram badge `Personalizado` ao lado do nome do item resumido na listagem.

---

### 3.4 PricingSettings — parâmetros globais

#### 3.4.1 Modelo

```prisma
model PricingSettings {
  id          String   @id @default("singleton")

  // Defaults usados quando o cálculo não tem Printer vinculada,
  // ou quando Printer não tem powerConsumptionWatts/acquisitionCostBRL.
  defaultEnergyCostPerHour    Decimal @db.Decimal(10, 4)  // 0.35
  defaultDepreciationPerHour  Decimal @db.Decimal(10, 4)  // 1.00
  defaultErrorRate            Decimal @db.Decimal(5, 4)   // 0.30

  // Tarifa de energia em R$/kWh. Quando o cálculo tem Printer.powerConsumptionWatts:
  //   costEnergy = (watts / 1000) * energyTariffPerKwh * hours
  // Caso contrário usa defaultEnergyCostPerHour * hours.
  energyTariffPerKwh          Decimal @db.Decimal(10, 4)  // 0.95

  // Faixas de margem sugerida (editável pelo admin).
  // Estrutura: [{ maxCost: number|null, marginPercent: number }]
  // Ordenado por maxCost asc. O último item com maxCost=null = "acima de tudo".
  // Default: [
  //   { maxCost: 15,   marginPercent: 1.00 },   // 100% para peças baratas
  //   { maxCost: 40,   marginPercent: 0.60 },   // 60% faixa média
  //   { maxCost: 100,  marginPercent: 0.50 },   // 50% faixa alta
  //   { maxCost: null, marginPercent: 0.40 }    // 40% peças grandes
  // ]
  marginTiersJson             Json

  updatedAt           DateTime @updatedAt
  updatedByEmail      String?
}
```

#### 3.4.2 Endpoints

```
GET    /api/admin/pricing-settings
PATCH  /api/admin/pricing-settings
  Body: campos a atualizar.
  Server: valida marginTiersJson estrutura. AuditLog.
```

#### 3.4.3 UI — `/admin/configuracoes/precificacao`

Página simples (similar a [/admin/configuracoes/alertas](../../../app/admin/configuracoes/alertas/page.tsx)):

```
┌── Configurações > Precificação ───────────────────────────────────────────┐
│                                                                            │
│  ┌── Defaults operacionais ──────────────────────────────────────────┐    │
│  │ Tarifa de energia (R$/kWh)            [0,95___]                   │    │
│  │ Energia default (R$/h)                [0,35___]                   │    │
│  │   (usado quando impressora não tem consumo cadastrado)            │    │
│  │ Depreciação default (R$/h)            [1,00___]                   │    │
│  │   (usado quando impressora não tem custo/lifetimeHours)           │    │
│  │ Taxa de erro padrão                   [30%____]                   │    │
│  └───────────────────────────────────────────────────────────────────┘    │
│                                                                            │
│  ┌── Faixas de margem sugerida ──────────────────────────────────────┐    │
│  │                                                                   │    │
│  │ Custo até      Margem sugerida                                    │    │
│  │ [R$ 15,00__]   [100%]   [×]                                       │    │
│  │ [R$ 40,00__]   [60%]    [×]                                       │    │
│  │ [R$ 100,00_]   [50%]    [×]                                       │    │
│  │ Acima de tudo  [40%]                                              │    │
│  │ [+ Adicionar faixa]                                               │    │
│  │                                                                   │    │
│  │ ℹ Use estas faixas como ponto de partida — admin sempre pode      │    │
│  │   sobrescrever a margem em cada orçamento.                        │    │
│  └───────────────────────────────────────────────────────────────────┘    │
│                                                                            │
│                                                       [Salvar alterações]  │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Fórmula de cálculo (canônica)

**Este é o contrato.** Backend e frontend (modo dry-run) devem produzir os mesmos números.

```
INPUTS:
  filamentGrams         Decimal
  filamentPricePerKg    Decimal  (de Filament ou override)
  printHours            Decimal
  printerWatts          Int?     (de Printer.powerConsumptionWatts; nullable)
  printerAcquisition    Decimal? (de Printer.acquisitionCostBRL)
  printerLifetimeHours  Int?     (de Printer.lifetimeHours)
  energyTariffPerKwh    Decimal  (de PricingSettings)
  defaultEnergyPerHour  Decimal  (de PricingSettings)
  defaultDeprecPerHour  Decimal  (de PricingSettings)
  errorRate             Decimal  (0.30 = 30%)
  components            Array<{ qty, unitCost }>
  marginPercent         Decimal  (0.60 = 60%)

CÁLCULO:
  pricePerGram     = filamentPricePerKg / 1000
  costFilament     = pricePerGram * filamentGrams

  // Energia — prefere consumo real da impressora se cadastrado
  if printerWatts != null:
    costEnergy     = (printerWatts / 1000) * energyTariffPerKwh * printHours
  else:
    costEnergy     = defaultEnergyPerHour * printHours

  // Depreciação — prefere TCO real da impressora
  if printerAcquisition != null AND printerLifetimeHours != null AND printerLifetimeHours > 0:
    costDepreciation = (printerAcquisition / printerLifetimeHours) * printHours
  else:
    costDepreciation = defaultDeprecPerHour * printHours

  costError        = costFilament * errorRate
  costComponents   = SUM(qty * unitCost) for all components
  costTotal        = costFilament + costEnergy + costDepreciation + costError + costComponents
  suggestedPrice   = costTotal * (1 + marginPercent)

ARREDONDAMENTO:
  Todos os valores monetários armazenados com 2 casas (Decimal(10, 2)).
  Cálculos intermediários em Decimal nativo (lib `decimal.js` já no projeto via Prisma).
  Arredondamento "half-up" no momento de persistir.
```

**Sugestão de margem (tier-based):**
```
findSuggestedMargin(costTotal, marginTiersJson):
  tiers = marginTiersJson sorted by maxCost asc (nulls last)
  for tier in tiers:
    if tier.maxCost is null OR costTotal <= tier.maxCost:
      return tier.marginPercent
```

**Localização do código:** `lib/pricing.ts` (novo arquivo, exporta `calculate()` e `findSuggestedMargin()`).

---

## 5. Plano de PRs

Os PRs seguem o padrão da SPEC-005: pequenos, com critério de aceite claro, testáveis em isolamento.

### PR-1 — Schema único + migration consolidada (gate)

**Branch:** `feat/spec-007-schema`
**Responsável:** dev-backend + security-architect (review)

Adições em `prisma/schema.prisma`:
- Novo: `PricingSettings`, `PricingEstimate`
- Alterações: `Order` (+4 colunas, +1 índice), `OrderItem` (+5 campos, +1 índice, `productId` → opcional)

Migration SQL (`prisma/migrations/<timestamp>_spec_007_pricing_and_manual_orders/migration.sql`):

```sql
-- 1. PricingSettings
CREATE TABLE "PricingSettings" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
  "defaultEnergyCostPerHour" DECIMAL(10,4) NOT NULL,
  "defaultDepreciationPerHour" DECIMAL(10,4) NOT NULL,
  "defaultErrorRate" DECIMAL(5,4) NOT NULL,
  "energyTariffPerKwh" DECIMAL(10,4) NOT NULL,
  "marginTiersJson" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "updatedByEmail" TEXT
);

-- Seed do singleton com defaults da planilha do stakeholder
INSERT INTO "PricingSettings" (
  "id", "defaultEnergyCostPerHour", "defaultDepreciationPerHour",
  "defaultErrorRate", "energyTariffPerKwh", "marginTiersJson", "updatedAt"
) VALUES (
  'singleton', 0.35, 1.00, 0.30, 0.95,
  '[{"maxCost":15,"marginPercent":1.00},{"maxCost":40,"marginPercent":0.60},{"maxCost":100,"marginPercent":0.50},{"maxCost":null,"marginPercent":0.40}]'::jsonb,
  NOW()
);

-- 2. PricingEstimate
CREATE TABLE "PricingEstimate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "productId" TEXT,
  "customerName" TEXT,
  "customerPhone" TEXT,
  "customerEmail" TEXT,
  "notes" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "filamentId" TEXT,
  "filamentGrams" DECIMAL(10,2) NOT NULL,
  "printHours" DECIMAL(10,2) NOT NULL,
  "printerId" TEXT,
  "componentsJson" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "filamentPricePerKgSnapshot" DECIMAL(10,2) NOT NULL,
  "energyCostPerHourSnapshot" DECIMAL(10,4) NOT NULL,
  "depreciationPerHourSnapshot" DECIMAL(10,4) NOT NULL,
  "errorRate" DECIMAL(5,4) NOT NULL,
  "marginPercent" DECIMAL(5,4) NOT NULL,
  "costFilament" DECIMAL(10,2) NOT NULL,
  "costEnergy" DECIMAL(10,2) NOT NULL,
  "costDepreciation" DECIMAL(10,2) NOT NULL,
  "costError" DECIMAL(10,2) NOT NULL,
  "costComponents" DECIMAL(10,2) NOT NULL,
  "costTotal" DECIMAL(10,2) NOT NULL,
  "suggestedPrice" DECIMAL(10,2) NOT NULL,
  "finalPrice" DECIMAL(10,2),
  "convertedToOrderId" TEXT,
  "convertedAt" TIMESTAMP(3),
  "createdByEmail" TEXT,
  "updatedByEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PricingEstimate_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL,
  CONSTRAINT "PricingEstimate_filamentId_fkey"
    FOREIGN KEY ("filamentId") REFERENCES "Filament"("id") ON DELETE SET NULL,
  CONSTRAINT "PricingEstimate_printerId_fkey"
    FOREIGN KEY ("printerId") REFERENCES "Printer"("id") ON DELETE SET NULL,
  CONSTRAINT "PricingEstimate_convertedToOrderId_fkey"
    FOREIGN KEY ("convertedToOrderId") REFERENCES "Order"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX "PricingEstimate_convertedToOrderId_key" ON "PricingEstimate"("convertedToOrderId");
CREATE INDEX "PricingEstimate_productId_idx" ON "PricingEstimate"("productId");
CREATE INDEX "PricingEstimate_status_idx" ON "PricingEstimate"("status");
CREATE INDEX "PricingEstimate_createdAt_idx" ON "PricingEstimate"("createdAt");

-- 3. Delta Order
ALTER TABLE "Order" ADD COLUMN "manualChannel" TEXT;
ALTER TABLE "Order" ADD COLUMN "referredBy" TEXT;
ALTER TABLE "Order" ADD COLUMN "internalNotes" TEXT;
ALTER TABLE "Order" ADD COLUMN "createdByEmail" TEXT;
CREATE INDEX "Order_manualChannel_idx" ON "Order"("manualChannel");

-- 4. Delta OrderItem — relaxa productId + novos campos
ALTER TABLE "OrderItem" ALTER COLUMN "productId" DROP NOT NULL;
ALTER TABLE "OrderItem" ADD COLUMN "itemType" TEXT NOT NULL DEFAULT 'catalog';
ALTER TABLE "OrderItem" ADD COLUMN "description" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "productionNotesItem" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "priceOverridden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrderItem" ADD COLUMN "estimateId" TEXT;

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_estimateId_fkey"
  FOREIGN KEY ("estimateId") REFERENCES "PricingEstimate"("id") ON DELETE SET NULL;
CREATE INDEX "OrderItem_itemType_idx" ON "OrderItem"("itemType");

-- 5. Backfill segurança
UPDATE "OrderItem" SET "itemType" = 'catalog' WHERE "itemType" IS NULL;
-- Nada para backfill em Order (todas as 4 colunas novas aceitam NULL)
```

**Critérios de aceite:**
- `prisma generate` roda sem erro local.
- `prisma migrate deploy` em staging passa sem rolled_back.
- `head -c 3 prisma/migrations/<...>/migration.sql | xxd` não retorna `efbbbf` (sem BOM — [coding-standards.md:55](../coding-standards.md:55)).
- Pedidos existentes carregam normalmente (todos com `itemType='catalog'`).
- `ci/check-required-order-columns.sh` adicionado para validar `manualChannel`, `referredBy`, `internalNotes`, `createdByEmail` (segue padrão SPEC-005).
- Smoke test: site público carrega, checkout funciona, `/admin/pedidos` lista pedidos antigos.

**Bloqueio operacional:** mergear apenas quando `prisma migrate deploy` rodar limpo no Railway (memória: incidente PR-5b 2026-05-14, 18min de prod fora por aborto indevido em migration `rolled_back`).

---

### PR-2a — API calculadora

**Branch:** `feat/spec-007-api-pricing`
**Depende de:** PR-1 mergeado em main + migration aplicada em prod.

Arquivos:
- `lib/pricing.ts` — calculadora pura, sem I/O.
- `app/api/admin/pricing-settings/route.ts` — GET, PATCH
- `app/api/orcamentos/route.ts` — GET (lista), POST
- `app/api/orcamentos/[id]/route.ts` — GET, PATCH, DELETE
- `app/api/orcamentos/calcular/route.ts` — POST (dry-run, sem persistir)
- `app/api/orcamentos/[id]/converter-pedido/route.ts` — POST
- `app/api/produtos/[id]/precificacao/calcular/route.ts` — POST
- `app/api/produtos/[id]/precificacao/route.ts` — PATCH

**Critérios de aceite:**
- Testes unitários de `lib/pricing.ts` cobrindo todos os branches (com/sem Printer, com/sem componentes, override de margem, sugestão tier-based).
- Reproduz **exatamente** os números da planilha do stakeholder em 4 cenários (linhas 1-4 da planilha enviada).
- Auditoria registrada em todas as mutações.
- Validação Zod rejeita payload mal-formado com 400 + mensagem clara.

---

### PR-2b — API pedido manual

**Branch:** `feat/spec-007-api-manual-order`
**Depende de:** PR-1.
**Pode rodar em paralelo com PR-2a.**

Arquivos:
- `app/api/admin/orders/route.ts` — POST (novo endpoint principal)
- `lib/order-validation.ts` — extensão para validar `itemType='custom'` (productId NULL + productNameSnapshot/unitPrice obrigatórios)

**Critérios de aceite:**
- Cria pedido sem `Customer` cadastrado (apenas customerName + phone).
- Cria pedido com mix de itens `catalog` + `custom`.
- `priceOverridden=true` quando `unitPrice ≠ Product.price` num item catalog.
- `paymentStatus='partial'` quando `initialInstallment.amount < total`.
- Idempotente em retry (mesma transação não duplica).
- Auditoria com `action='ORDER_CREATED_MANUALLY'`.

---

### PR-3a1 — UI calculadora avulsa (`/admin/orcamentos`)

**Branch:** `feat/spec-007-ui-orcamentos`
**Depende de:** PR-2a.

Arquivos:
- `app/admin/orcamentos/page.tsx` — listagem
- `app/admin/orcamentos/novo/page.tsx` — formulário criação
- `app/admin/orcamentos/[id]/page.tsx` — visualização/edição
- `app/admin/orcamentos/_components/EstimateForm.tsx` — formulário compartilhado
- `app/admin/orcamentos/_components/CostBreakdownCard.tsx` — bloco "Cálculo"
- `app/admin/orcamentos/_components/ComponentSelector.tsx` — busca + qty
- `app/admin/orcamentos/_components/ConvertToOrderModal.tsx` — modal de conversão
- Atualizar [app/admin/layout.tsx:10-26](../../../app/admin/layout.tsx:10) para incluir item "Orçamentos".

**Critérios de aceite:**
- Item de menu aparece entre "Despesas" e "Avaliações" no sidebar.
- Cálculo em tempo real com debounce 300ms; sem flicker.
- Todas as cores conforme [coding-standards.md:117-197](../coding-standards.md). **Auditável com grep:** zero ocorrência de classes `bg-zinc-*`, `text-zinc-*`, `bg-black`, `dark:`, `rounded-*` em `app/admin/orcamentos/**`.
- Card style idêntico ao `OrderPaymentsSection.tsx`.
- Modal "Converter em pedido" segue padrão `RegisterInstallmentModal.tsx`.
- Reproduz números da planilha do stakeholder ao preencher o cenário "Fernando — Círculo Dardo".

---

### PR-3a2 — UI calculadora de produto

**Branch:** `feat/spec-007-ui-product-pricing`
**Depende de:** PR-2a (compartilha endpoints).
**Pode rodar em paralelo com PR-3a1.**

Arquivos:
- `app/admin/produtos/[id]/precificacao/page.tsx` — aba/seção de precificação
- `app/admin/produtos/[id]/_components/PricingTab.tsx`
- Link na página de edição de produto (atualmente em `/admin/produtos/page.tsx` — verificar se já existe rota `[id]` ou se vive em modal; se for modal, esta tela substitui parte dele).

**Critérios de aceite:**
- Lê `Product.printingMinutes`, `markupPercent`, `errorRatePercent`, `printerForCostId`, `ProductFilament[]`, `ProductComponent[]`.
- "Aplicar preço sugerido" abre modal de confirmação se variação >20%.
- "Salvar parâmetros" persiste em `Product` sem mudar `price`.

---

### PR-3a3 — UI configurações de precificação

**Branch:** `feat/spec-007-ui-settings`
**Depende de:** PR-2a.
**Pequeno (~150 linhas).**

Arquivos:
- `app/admin/configuracoes/precificacao/page.tsx`

**Critérios de aceite:**
- Edita defaults globais.
- CRUD inline de tiers de margem (add/remove/edit faixas).
- Validação: tiers ordenados, último com `maxCost=null`, percentuais entre 0 e 5 (500%).

---

### PR-3b — Extensão modal "Novo Pedido"

**Branch:** `feat/spec-007-ui-manual-order`
**Depende de:** PR-2b.
**Pode rodar em paralelo com PR-3a1/3a2/3a3.**

Arquivos:
- `app/admin/pedidos/_components/NovoPedidoModal.tsx` (extrair do `page.tsx` se ainda estiver inline)
- `app/admin/pedidos/_components/ItemTypeToggle.tsx`
- `app/admin/pedidos/_components/CustomItemFields.tsx`
- `app/admin/pedidos/_components/ChannelSelector.tsx`

**Critérios de aceite:**
- Toggle catalog/custom por item.
- Item custom rejeita salvar sem nome + preço.
- Filtro de canal funciona na listagem.
- Coluna "Canal" como chip discreto.

---

### PR-4 — Ponte orçamento → pedido manual

**Branch:** `feat/spec-007-bridge`
**Depende de:** PR-3a1 + PR-3b mergeados.

Arquivos:
- Botão "→ Converter em pedido" na listagem/detalhe de orçamento (já modelado em 3a1) navega para `/admin/pedidos?novoPedido=true&fromEstimate=<id>` que abre o modal pré-preenchido.

**Critérios de aceite:**
- Estimate com item de catálogo + componentes → pedido com 1 item catalog + bloco de notas internas com detalhes do orçamento.
- Estimate sem product (avulso) → pedido com 1 item `custom`, productNameSnapshot=estimate.name, unitPrice=finalPrice ou suggestedPrice, description=estimate.notes, productionNotesItem com lista de componentes.
- Marca `estimate.status='converted'` e `convertedToOrderId`.
- AuditLog em ambos os lados.

---

## 6. Critérios de aceite globais (definição de "pronto")

Para a SPEC-007 ser considerada entregue:

1. **Calculadora reproduz a planilha do stakeholder.** 4 cenários da planilha (linhas 1-4) calculados na UI batem com os valores exatos da planilha (R$ 81,95 / R$ 147,51 etc.).
2. **Orçamento substitui a planilha.** Stakeholder consegue criar pelo menos 3 orçamentos novos pela UI sem precisar do Excel.
3. **Pedido manual sem `productId`.** Admin cria pedido com item personalizado avulso sem precisar criar produto no catálogo.
4. **Ponte funciona.** Pelo menos 1 orçamento convertido em pedido, com `estimate.convertedToOrderId` e `OrderItem.estimateId` corretamente referenciados.
5. **Catálogo intacto.** Listagem pública de produtos não mostra itens-fantasma; nenhum produto fake foi criado pelo fluxo de orçamento.
6. **Pedidos do site continuam funcionando** (regressão zero).
7. **`/minha-conta/pedidos` continua filtrando** `createdVia='admin'` (pedidos manuais não vazam).
8. **Audit log registra** todas as operações sensíveis (estimate created/updated/converted, order_created_manually, pricing_settings_updated).
9. **Sem regressão de tema visual.** Auditor `grep -r "bg-zinc\|dark:" app/admin/orcamentos app/admin/configuracoes/precificacao app/admin/produtos/[id]/precificacao` retorna zero.
10. **Backfill checado.** `SELECT COUNT(*) FROM "OrderItem" WHERE "itemType" IS NULL` = 0.

---

## 7. Riscos e mitigação

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Migration falha em prod por Prisma CLI quebrado | Média (já aconteceu duas vezes recentes) | Alto (boot falha) | Testar `prisma migrate deploy` em staging com flag `--create-only` e revisão manual do SQL gerado. Mergear PR-1 só após sucesso em staging confirmado nos últimos commits de main. |
| Relaxar `OrderItem.productId` (de NOT NULL para nullable) quebra queries com `include: { product: true }` em código existente | Alta | Médio (telas com erro) | PR-1 inclui auditoria de todos os usos de `orderItem.product` no codebase. Onde for usado, encadear `?.` ou guard explícito. Lista de arquivos no PR description. |
| Cálculo de pricing diverge entre frontend (dry-run preview) e backend (persistido) | Média | Médio (admin vê valor X, banco grava Y) | `lib/pricing.ts` é a **única** fonte. Frontend importa o **mesmo** módulo via uma rota dry-run no servidor (não recalcula em JS puro do cliente). Testes garantem mesma saída. |
| Stakeholder ajusta tiers de margem muito agressivos e perde dinheiro | Baixa | Alto | Mostrar preço sugerido E preço atual lado a lado no modo 1; modal de confirmação se alteração >20%; AuditLog em PricingSettings.update. |
| Tema visual destoa (PR-8a vibe) | Média | Médio (retrabalho) | Critério de aceite #9 é grep auditável. QA tester valida lado a lado com `OrderPaymentsSection`. |
| Conversão de orçamento em pedido cria pedido sem cliente | Baixa | Baixo (UX) | Modal de conversão exibe campo "Cliente" pré-preenchido editável; se vazio, mostra aviso ("pedido sem cliente vai pra `customerName`/`customerPhone` inline"). |
| Componente referenciado em `componentsJson` é deletado depois | Baixa | Baixo (UX) | Snapshot preservado em JSON; UI renderiza com `name` do snapshot e marca `(componente removido)` se buscar componente original. |
| Pedido manual com `initialInstallment` cria duplicidade com webhook do MP | Baixíssima (MP não toca em pedido admin) | Médio | Já protegido por SPEC-005; webhook só atua em pedidos com `Payment.providerPaymentId` preenchido (sempre vazio em pedido manual). |

---

## 8. Decisões abertas (precisam de confirmação antes de mergear)

1. **D1 — Onde vive a edição de Product hoje?** A página `/admin/produtos/page.tsx` parece concentrar listagem + edição inline em modal. PR-3a2 precisa decidir entre:
   - (a) criar rota nova `/admin/produtos/[id]/precificacao` (mais limpo, requer extrair edição em rota com `[id]`)
   - (b) adicionar aba dentro do modal atual (menos refactor, modal fica grande)
   - **Recomendação:** (a). Mas confirmar com stakeholder se aceita o refactor que extrai a tela de edição.

2. **D2 — Conversão de orçamento para item de catálogo.** Quando `estimate.productId != null`, criar `OrderItem` como `itemType='catalog'` com `unitPriceOverride=finalPrice`? Ou criar como `itemType='custom'` herdando descrição? **Recomendação:** `catalog` quando há productId vinculado (preserva a relação com o produto); `custom` quando avulso. Já está modelado assim em 3.4.

3. **D3 — Item de menu "Orçamentos" no sidebar.** Confirmar nome. Alternativas: "Orçamentos", "Cotações", "Precificação". **Recomendação:** "Orçamentos" (próximo do vocabulário do stakeholder na conversa de desenho).

4. **D4 — Limite de quantidade para item personalizado.** Hoje algumas validações assumem `quantity >= 1`. Confirmar se há limite máximo razoável (ex: 999) para evitar abuso/typo.

5. **D5 — LGPD em orçamentos com dados de cliente não-cadastrado.** Igual à decisão pendente da SPEC-005 (LGPD R15/R22 para pedidos admin). Não bloqueia funcionamento. Mover para SPEC-008 (LGPD consolidada).

---

## 9. Telemetria e métricas de sucesso

Após 30 dias em prod, medir:

- Nº de orçamentos criados/semana → indica se substituiu a planilha.
- Taxa de conversão orçamento → pedido (`converted / (sent + approved + converted)`).
- Nº de pedidos com `itemType='custom'` → indica adoção do fluxo manual real.
- Distribuição de `manualChannel` → revela canais mais ativos (alimenta marketing).
- Variação média entre `suggestedPrice` e `finalPrice` → indica se os tiers de margem estão calibrados.
- Tempo médio entre criação de orçamento e conversão → ciclo de venda.

Painel: adicionar bloco em `/admin` (dashboard) com esses indicadores. **Fora do escopo desta SPEC** — fica para SPEC-009 (Analytics admin).

---

## 10. Referências canônicas

Ao implementar, copiar o estilo destes arquivos quando houver dúvida sobre padrão visual ou estrutural:

| Necessidade | Referência |
|---|---|
| Card simples | `app/admin/pedidos/[id]/page.tsx` (função `Card` no fim) |
| Card complexo com tiles + lista | `app/admin/pedidos/[id]/_components/OrderPaymentsSection.tsx` |
| Modal com formulário completo | `app/admin/pedidos/[id]/_components/RegisterInstallmentModal.tsx` |
| Tabela com truncamento e filtros | `app/admin/pedidos/page.tsx`, `app/admin/auditoria/page.tsx` |
| Formulário de criação em rota dedicada | `app/admin/despesas/nova/page.tsx` |
| Página de configurações | `app/admin/configuracoes/alertas/page.tsx` |
| Endpoint admin com guard | `app/api/admin/email-campaigns/route.ts` |
| Endpoint com transação Prisma | `lib/installments.ts::recalculatePaidAmount` |
| Validação Zod em endpoint | `app/api/pedidos/[id]/installments/route.ts` |

**Documentos:**
- [docs/implementation/coding-standards.md](../coding-standards.md) — convenções gerais + paleta admin
- [docs/implementation/spec/SPEC-005-edicao-producao-pagamentos-parciais.md](./SPEC-005-edicao-producao-pagamentos-parciais.md) — padrão de spec
- [docs/implementation/adr/ADR-003-spec-005-safety-review.md](../adr/ADR-003-spec-005-safety-review.md) — gates de migration

---

## Changelog

- **1.0 (2026-05-14)** — Versão inicial. Decisões do stakeholder consolidadas (paralelo F1+F2, sem upload no MVP, margem editável). Aguardando aprovação para iniciar PR-1.
