# Snapshot UI — Cadastro/Edição de Produtos (admin)

**Rota:** `/admin/produtos`
**Stack:** Next.js 16 (App Router) + React + TypeScript. **Sem Tailwind** — todos os estilos são inline (`style={{ ... }}`).

> Este documento consolida os 5 arquivos JSX que compõem a tela de cadastro/edição de produtos para revisão de UX/visual no Claude Design (ou outra ferramenta). Cada arquivo é apresentado com o caminho relativo no repo.

---

## Sumário

1. [Paleta de cores e tokens visuais](#paleta-de-cores-e-tokens-visuais)
2. [Layout do admin (sidebar + main)](#layout-do-admin)
3. [Página principal — `/admin/produtos`](#1-pagina-principal--apppadminprodutospagetsx)
4. [Editor de galeria de imagens](#2-editor-de-galeria--componentsadminproductgalleryeditortsx)
5. [Editor de variações](#3-editor-de-variacoes--componentsadminproductvariantseditortsx)
6. [Manager de BOM (componentes)](#4-manager-de-bom-componentes--componentsadminproductbommanagertsx)
7. [Calculadora de custo](#5-calculadora-de-custo--componentsadminproductcostcalculatortsx)
8. [Primitives — Button e Input](#primitives--button-e-input)

---

## Paleta de cores e tokens visuais

```
Texto principal       #1D2235  (azul-marinho profundo)
Texto secundário      #6B7494  (cinza-azulado)
Texto fraco           #A8AFCA
Borda padrão          #D8DCE8
Borda card sutil      #E3E9F4
Background admin      #F0F5FB  (azul muito claro)
Background página     #F9FBFD  (quase branco)
Card / superfície     #FFFFFF
Acento azul           #4A7AB5  (eyebrow / labels)
Acento azul claro BG  #E4EDF8  (badge bg)
Primário escuro       #1D2235  (botões CTA)
Primário azul vivo    #4A7AB5
Rosa/destaque         #D4849A
Sucesso BG / texto    #DCFCE7 / #166534
Erro BG / texto       #FEE2E2 / #B42318
Aviso BG / texto      #FEF3C7 / #92400E
```

**Tipografia:**
- Body / display: variáveis `--font-body`, `--font-display`
- Mono (preços, SKU): `var(--font-mono)`

**Border-radius padrão:**
- Inputs / botões pequenos: `6–10px`
- Cards: `12–16px`
- Pills / badges: `999px`

**Sombras:**
- Card padrão: `0 1px 3px rgba(0,0,0,0.06)`
- Modal / destaque: `0 12px 30px rgba(29,34,53,0.08)`

---

## Layout do admin

Sidebar fixa de 252px à esquerda + main com `padding: 32px`. Conteúdo do main é envolvido em `max-width: 1240px` centralizado.

Sidebar usa fundo `#1D2235` com texto `rgba(240,245,251, X)`. Item ativo recebe borda esquerda `3px solid #D4849A` e background `rgba(187,207,235,0.14)`.

Item "Componentes" pode mostrar **badge vermelho** com contagem de em-baixa.

---

## 1. Página principal — `app/admin/produtos/page.tsx`

```tsx
'use client'

import { useEffect, useState } from 'react'
import Button from '@/components/Button'
import Input from '@/components/Input'
import ProductGalleryEditor from '@/components/admin/ProductGalleryEditor'
import ProductVariantsEditor from '@/components/admin/ProductVariantsEditor'
import ProductBomManager from '@/components/admin/ProductBomManager'
import ProductCostCalculator from '@/components/admin/ProductCostCalculator'

interface Product {
  id: string
  name: string
  slug: string
  price: number
  category: string
  description: string
  isActive: boolean
  isFeatured: boolean
  isPersonalizable: boolean
  status: string
  stock: number
  underOrder: boolean
  sku?: string
  productionMinutesPerUnit?: number | null
}

interface Category {
  id: string
  name: string
  slug: string
  isActive: boolean
}

const emptyForm = {
  name: '',
  price: '',
  category: '',
  description: '',
  stock: '0',
  underOrder: false,
  sku: '',
  isPersonalizable: false,
  isFeatured: false,
  productionMinutesPerUnit: '',
}

export default function AdminProductsPage() {
  // ... [state setup omitido — useState pra products, categories, formData,
  //      selectedIds, bulkBusy, searchTerm, editingId, showForm]
  // ... [load handlers, submit, edit, delete, toggle, bulk actions]

  return (
    <div>
      {/* Cabeçalho */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1D2235' }}>Produtos</h1>
          <p style={{ color: '#6B7494' }}>Gerencie seus produtos</p>
        </div>
        <Button variant={showForm ? 'outline' : 'blue'} onClick={() => (showForm ? resetForm() : setShowForm(true))}>
          {showForm ? 'Cancelar' : '+ Novo Produto'}
        </Button>
      </header>

      {/* Busca */}
      <div style={{ marginBottom: '24px' }}>
        <Input placeholder="Buscar produtos..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      {/* Form de cadastro/edição */}
      {showForm && (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', marginBottom: '24px', boxShadow: '0 12px 30px rgba(29,34,53,0.08)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '24px', color: '#1D2235' }}>
            {editingId ? 'Editar produto' : 'Novo produto'}
          </h2>
          <form onSubmit={handleSubmit}>
            {/* Grid de campos básicos: nome, preço, categoria, estoque, SKU, tempo */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <Input label="Nome do produto" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required placeholder="Ex: Porta-retratos" />
              <Input label="Preco" type="number" step="0.01" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} required placeholder="89.90" />
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '6px', color: '#1D2235' }}>Categoria</label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  required
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid #D8DCE8', fontSize: '16px', color: '#1D2235', backgroundColor: 'white' }}
                >
                  <option value="">Selecione...</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.slug}>{category.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Input label="Estoque" type="number" value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })} placeholder="0" />
                <p style={{ marginTop: '6px', fontSize: '12px', color: '#6B7494', lineHeight: 1.4 }}>
                  Se cadastrar variações abaixo, o estoque será gerenciado por variação e este valor será ignorado.
                </p>
              </div>
              <Input label="SKU" value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value })} placeholder="Codigo SKU (opcional)" />
              <Input
                label="Tempo estimado por unidade (minutos)"
                type="number"
                min="0"
                step="1"
                value={formData.productionMinutesPerUnit}
                onChange={e => setFormData({ ...formData, productionMinutesPerUnit: e.target.value })}
                placeholder="Opcional. Ex: 90"
              />
            </div>

            {/* Sub-editores aparecem só em modo edição (após salvar produto novo) */}
            {editingId ? (
              <>
                <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #EEF1F8' }}>
                  <ProductGalleryEditor productId={editingId} />
                </div>
                <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #EEF1F8' }}>
                  <ProductVariantsEditor productId={editingId} />
                </div>
                <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #EEF1F8' }}>
                  <ProductBomManager productId={editingId} />
                </div>
                <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #EEF1F8' }}>
                  <ProductCostCalculator productId={editingId} />
                </div>
              </>
            ) : (
              <div style={{ marginTop: '20px', padding: '14px 16px', background: '#F0F5FB', borderRadius: '10px', fontSize: '13px', color: '#1D2235' }}>
                💡 Após salvar o produto, a galeria de imagens e as variações ficarão disponíveis para você adicionar fotos, opções de tamanho/cor e definir o estoque por variação.
              </div>
            )}

            {/* Descrição */}
            <div style={{ marginTop: '16px' }}>
              <Input label="Descricao" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Descricao do produto" />
            </div>

            {/* Flags */}
            <div style={{ marginTop: '16px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#1D2235' }}>
                <input type="checkbox" checked={formData.isPersonalizable} onChange={e => setFormData({ ...formData, isPersonalizable: e.target.checked })} />
                <span>Personalizavel</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#1D2235' }}>
                <input type="checkbox" checked={formData.isFeatured} onChange={e => setFormData({ ...formData, isFeatured: e.target.checked })} />
                <span>Destaque</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#1D2235' }}>
                <input type="checkbox" checked={formData.underOrder} onChange={e => setFormData({ ...formData, underOrder: e.target.checked })} />
                <span>Sob encomenda</span>
              </label>
            </div>

            {/* Ações */}
            <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
              <Button type="submit" variant="blue" disabled={!categories.length}>{editingId ? 'Salvar' : 'Criar produto'}</Button>
              <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
            </div>
          </form>
        </div>
      )}

      {/* Tabela de produtos com seleção em massa */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 12px 30px rgba(29,34,53,0.08)' }}>
        {hasSelection && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', padding: '14px 16px', background: '#1D2235', color: 'white', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Barra de ações em massa: ativar, desativar, destacar, mudar categoria, etc. */}
          </div>
        )}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#F0F5FB', borderBottom: '1px solid #D8DCE8' }}>
              <th style={{ padding: '16px', textAlign: 'left', width: '40px' }}>
                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
              </th>
              <th>Produto</th>
              <th>Categoria</th>
              <th>Preco</th>
              <th>Estoque</th>
              <th>Status</th>
              <th>Destaque</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {/* linhas com checkbox + nome + categoria + preço mono + badge de estoque/sob-encomenda + toggles status/featured + botões editar/excluir */}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

---

## 2. Editor de galeria — `components/admin/ProductGalleryEditor.tsx`

Grid de até 8 imagens (`gridTemplateColumns: repeat(auto-fill, minmax(160px, 1fr))`). Cada item tem aspect-ratio 1:1. Imagem principal recebe borda verde `2px solid #1D7A72` e badge "PRINCIPAL". Quando vinculada a uma variação, badge rosa `#A3526A`.

```tsx
return (
  <div>
    {/* Cabeçalho com contador X/8 e botão "+ Adicionar imagem" */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px', gap: '12px', flexWrap: 'wrap' }}>
      <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1D2235', margin: 0 }}>
        Galeria de imagens ({images.length}/8)
      </h3>
      <button type="button" onClick={() => fileInputRef.current?.click()} style={{
        padding: '8px 14px', borderRadius: '8px', border: '1px solid #D8DCE8',
        background: '#F0F5FB', color: '#1D2235', fontSize: '13px', fontWeight: 600,
      }}>
        + Adicionar imagem
      </button>
    </div>

    <p style={{ fontSize: '12px', color: '#6B7494' }}>
      JPG, PNG ou WebP até 10 MB cada. Reordene com as setas. A imagem principal aparece destacada.
    </p>

    {/* Estado vazio */}
    {images.length === 0 ? (
      <p style={{ color: '#6B7494', fontSize: '13px', padding: '24px', background: '#F0F5FB', borderRadius: '10px', textAlign: 'center' }}>
        Nenhuma imagem adicional. Adicione fotos para mostrar o produto de vários ângulos.
      </p>
    ) : (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
        {images.map((img, index) => (
          <li key={img.id} style={{
            background: 'white',
            border: img.isMain ? '2px solid #1D7A72' : '1px solid #D8DCE8',
            borderRadius: '12px',
            overflow: 'hidden',
            position: 'relative',
          }}>
            <div style={{ position: 'relative', aspectRatio: '1', background: '#E4EDF8' }}>
              <img src={img.url} alt={img.alt || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {img.isMain && (
                <span style={{ position: 'absolute', top: '6px', left: '6px', background: '#1D7A72', color: 'white', fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px' }}>
                  PRINCIPAL
                </span>
              )}
              {variantName && (
                <span style={{ position: 'absolute', top: '6px', right: '6px', background: '#A3526A', color: 'white', fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px' }}>
                  {variantName}
                </span>
              )}
            </div>
            <div style={{ padding: '8px', display: 'grid', gap: '6px' }}>
              {/* Botões: ← → reordenar, select de variação, "Definir como principal", "Remover" */}
            </div>
          </li>
        ))}
      </ul>
    )}
  </div>
)
```

---

## 3. Editor de variações — `components/admin/ProductVariantsEditor.tsx`

Tabela com colunas Nome, SKU, Atributos (cor/tamanho/material/acabamento), Preço, Estoque, Ativo, Ações. Form de criar/editar usa radios pra escolher entre "variação do preço base" ou "preço fixo absoluto".

```tsx
return (
  <div>
    {/* Cabeçalho */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
      <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1D2235', margin: 0 }}>
        Variações do produto ({variants.length})
      </h3>
      {!showForm && (
        <button type="button" onClick={startCreate} style={{
          padding: '8px 14px', borderRadius: '8px', border: '1px solid #D8DCE8',
          background: '#F0F5FB', color: '#1D2235', fontSize: '13px', fontWeight: 600,
        }}>
          + Nova variação
        </button>
      )}
    </div>

    <p style={{ fontSize: '12px', color: '#6B7494' }}>
      Use variações para gerenciar estoque por opção (ex: tamanhos, cores, materiais). Ao cadastrar variações, o estoque global do produto é ignorado.
    </p>

    {/* Estado vazio */}
    {variants.length === 0 && !showForm ? (
      <p style={{ color: '#6B7494', fontSize: '13px', padding: '24px', background: '#F0F5FB', borderRadius: '10px', textAlign: 'center' }}>
        Este produto ainda não tem variações.
      </p>
    ) : (
      <div style={{ border: '1px solid #D8DCE8', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#F0F5FB', borderBottom: '1px solid #D8DCE8' }}>
              <th>Nome</th><th>SKU</th><th>Atributos</th><th>Preço</th><th>Estoque</th><th>Ativo</th><th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {variants.map(v => (
              <tr key={v.id} style={{ borderBottom: '1px solid #EEF1F8' }}>
                <td><strong>{v.name}</strong></td>
                <td style={{ color: '#6B7494', fontFamily: 'var(--font-mono)' }}>{v.sku || '—'}</td>
                <td style={{ color: '#6B7494' }}>{formatAttributes(v)}</td>
                <td>{formatPrice(v)}</td>
                <td>
                  <span style={{ color: v.stockQuantity > 0 ? '#1D7A72' : '#A3526A', fontWeight: 600 }}>
                    {v.stockQuantity} un
                  </span>
                </td>
                <td>
                  <button onClick={() => handleToggleAvailable(v)} style={{
                    padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
                    backgroundColor: v.isAvailable ? '#DFF4EC' : '#FDE8E8',
                    color: v.isAvailable ? '#1D7A72' : '#B42318',
                  }}>
                    {v.isAvailable ? 'SIM' : 'NÃO'}
                  </button>
                </td>
                <td>
                  <button onClick={() => startEdit(v)}>Editar</button>
                  <button onClick={() => handleDelete(v.id)}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}

    {/* Form em card branco com border, 4 grid de inputs (cor/tamanho/material/acabamento)
        + radio "delta vs override" + estoque + checkbox "Disponível" + botões Salvar/Cancelar */}
  </div>
)
```

---

## 4. Manager de BOM (componentes) — `components/admin/ProductBomManager.tsx`

Card branco com badge de "Cobertura" (verde/vermelho) no canto superior direito mostrando "Dá pra produzir N unidades". Listas agrupadas em "Vínculos globais" e "Vínculos da variação X". Cada linha tem badge "em baixa" (vermelho) se o componente cruzou o threshold.

```tsx
return (
  <section style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
    {/* Cabeçalho com badge de cobertura à direita */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: '17px', color: '#1D2235' }}>Componentes deste produto</h2>
        <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6B7494' }}>
          Declare o que cada unidade consome. A produção vai descontar automaticamente do estoque.
        </p>
      </div>
      {/* Badge "Dá pra produzir N unidades" */}
      <div style={{ background: isLow ? '#FEE2E2' : '#DCFCE7', color: isLow ? '#B42318' : '#166534', padding: '8px 14px', borderRadius: '10px' }}>
        <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Dá pra produzir</p>
        <p style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
          {value} {value === 1 ? 'unidade' : 'unidades'}
        </p>
      </div>
    </div>

    {/* Estado vazio (banner amarelo) */}
    {entries.length === 0 && (
      <div style={{ background: '#FEF3C7', color: '#92400E', padding: '12px 14px', borderRadius: '8px', fontSize: '13px' }}>
        ⚠️ Este produto não tem componentes vinculados — a produção não vai debitar estoque.
      </div>
    )}

    {/* Lista de vínculos */}
    {entries.length > 0 && (
      <div style={{ display: 'grid', gap: '14px', marginBottom: '14px' }}>
        {/* Subtítulo "VÍNCULOS GLOBAIS (TODAS AS VARIAÇÕES)" */}
        {/* Cada linha: nome do componente + badge "em baixa" se aplicável + estoque atual + cobertura em unidades + quantidade por unidade + botões Editar/Remover inline */}
      </div>
    )}

    {/* Form pra adicionar (DIV, não FORM, pois está dentro de outro form) */}
    <div style={{ borderTop: '1px solid #E3E9F4', paddingTop: '14px', display: 'grid', gap: '10px' }}>
      <h3 style={{ fontSize: '14px', color: '#1D2235' }}>+ Vincular novo componente</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
        {/* Select Componente, Quantidade por unidade, Aplicar a (variação), Observação */}
      </div>
      <div>
        <button type="button" onClick={handleAdd} style={{ padding: '8px 16px', borderRadius: '8px', background: '#1D2235', color: 'white' }}>
          + Adicionar componente
        </button>
      </div>
    </div>
  </section>
)
```

---

## 5. Calculadora de custo — `components/admin/ProductCostCalculator.tsx`

**Layout em 2 colunas:** main esquerda (filamentos + tempo/equipamento) + sidebar 360px **sticky** com decomposição em tempo real e preço final bidirecional.

```tsx
return (
  <section style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
    {/* Cabeçalho */}
    <div style={{ marginBottom: '12px' }}>
      <h2 style={{ fontSize: '17px', color: '#1D2235' }}>Calculadora de custo</h2>
      <p style={{ fontSize: '13px', color: '#6B7494' }}>
        Custo de produção baseado em filamentos, tempo de impressão, energia e depreciação. Markup e preço final são bidirecionais.
      </p>
    </div>

    {/* Layout 2 colunas */}
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 360px)', gap: '20px' }}>
      {/* COLUNA ESQUERDA */}
      <div>
        <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          FILAMENTOS CONSUMIDOS POR UNIDADE
        </h3>

        {/* Lista de filamentos vinculados */}
        <div style={{ border: '1px solid #E3E9F4', borderRadius: '10px', overflow: 'hidden' }}>
          {filaments.map(entry => (
            <div style={{ padding: '12px 14px', display: 'grid', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Bolinha de cor do filamento, 20px */}
                {entry.filamentColorHex && (
                  <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: entry.filamentColorHex, border: '1px solid #D8DCE8' }} />
                )}
                <div>
                  <p>
                    {entry.filamentName}
                    <span style={{ background: '#E4EDF8', color: '#4A7AB5', fontSize: '11px', padding: '2px 8px', borderRadius: '999px', marginLeft: '8px' }}>
                      {entry.filamentType}
                    </span>
                  </p>
                  <p style={{ fontSize: '12px', color: '#6B7494' }}>
                    {entry.filamentBrand} · {brl(entry.pricePerKg)}/kg
                  </p>
                </div>
              </div>
              <p style={{ fontSize: '13px' }}>
                <strong>{entry.grams}g</strong> = <strong>{brl(entry.cost)}</strong>
              </p>
            </div>
          ))}
        </div>

        {/* Form pra adicionar filamento (DIV não FORM) */}
        <div style={{ display: 'grid', gap: '10px', marginBottom: '20px' }}>
          <h4 style={{ fontSize: '13px' }}>+ Adicionar filamento</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
            {/* Select Filamento (com bolinha lateral preview), Gramas, Aplicar a, Observação */}
          </div>
          <button type="button" onClick={addFilament} style={{ padding: '8px 14px', background: '#1D2235', color: 'white', justifySelf: 'start' }}>
            + Vincular
          </button>
        </div>

        <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase' }}>TEMPO & EQUIPAMENTO</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
          {/* Tempo de impressão (min), Impressora usada (com aviso amarelo se faltar dados),
              Taxa de erro %, Markup % */}
        </div>

        <button type="button" onClick={saveSettings} style={{ padding: '10px 18px', background: '#1D2235', color: 'white' }}>
          Salvar configuração de custo
        </button>
      </div>

      {/* COLUNA DIREITA — Sidebar sticky com decomposição */}
      <aside style={{ position: 'sticky', top: '24px', alignSelf: 'start' }}>
        <div style={{ background: '#F9FBFD', borderRadius: '12px', padding: '16px', border: '1px solid #E3E9F4' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700 }}>Decomposição</h3>
          {/* Linhas: Filamento, Erro X%, Energia, Depreciação, hr, Custo total (bold) */}

          <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #E3E9F4' }}>
            <p style={{ fontSize: '12px', color: '#6B7494', fontWeight: 600 }}>Preço sugerido (com markup)</p>
            <p style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              {brl(breakdown.suggested)}
            </p>
          </div>

          <div style={{ marginTop: '14px' }}>
            {/* Field "Preço final (R$)" — input que recalcula markup quando editado */}
            <input type="number" value={finalPrice} onChange={e => handleFinalPriceChange(e.target.value)} style={{ fontWeight: 700 }} />
            <p style={{ fontSize: '11px', color: '#6B7494' }}>
              Editar este valor recalcula o markup. Salve abaixo pra persistir.
            </p>
          </div>
        </div>
      </aside>
    </div>
  </section>
)
```

---

## Primitives — Button e Input

### `components/Button.tsx`

5 variants (`primary`, `secondary`, `outline`, `ghost`, `blue`) e 3 sizes (`sm`, `md`, `lg`).

```tsx
const variantStyles = {
  primary:   { backgroundColor: '#1D2235', color: 'white',   border: 'none' },
  secondary: { backgroundColor: '#BBCFEB', color: '#1D2235', border: 'none' },
  outline:   { backgroundColor: 'transparent', color: '#1D2235', border: '1px solid #D8DCE8' },
  ghost:     { backgroundColor: 'transparent', color: '#1D2235', border: 'none' },
  blue:      { backgroundColor: '#4A7AB5', color: 'white', border: 'none' },
}

const sizeStyles = {
  sm: { padding: '8px 16px',  fontSize: '14px' },
  md: { padding: '12px 24px', fontSize: '16px' },
  lg: { padding: '16px 32px', fontSize: '18px' },
}

const baseStyle = {
  fontFamily: 'var(--font-body)',
  fontWeight: 600,
  borderRadius: '10px',
  cursor: 'pointer',
  transition: 'all var(--transition-fast)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
}
```

### `components/Input.tsx`

```tsx
<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
  {label && (
    <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-dark)' }}>
      {label}
    </label>
  )}
  <input style={{
    padding: '12px 16px',
    borderRadius: '10px',
    border: error ? '1px solid #D4849A' : '1px solid #D8DCE8',
    fontSize: '16px',
    fontFamily: 'var(--font-body)',
    outline: 'none',
    backgroundColor: 'white',
    color: 'var(--color-dark)',
  }} />
  {error && <span style={{ fontSize: '14px', color: '#A3526A' }}>{error}</span>}
</div>
```

---

## Notas de UX que valem revisar

1. **Hierarquia vertical pesada:** o form de produto tem 5 sub-seções empilhadas. Considerar tabs ou steps.
2. **Calculadora de custo** já tem layout 2-col bom; pode inspirar o resto.
3. **Tabela principal** tem 8 colunas + barra de bulk actions; em mobile fica difícil. Não há tratamento responsivo explícito.
4. **Form em modal de criar vs edit** — primeiro salva sem sub-editores, depois reabre com tudo. Pode confundir; uma stepper "Básico → Galeria → Variações → Componentes → Custo" seria mais clara.
5. **Cores de status** (verde/vermelho/amarelo) são consistentes mas usam tons levemente diferentes em cada componente. Vale padronizar.
6. **Inputs** são quase todos `12px 16px / 10px radius`, mas a calculadora usa `8px 10px / 6px radius` por ser mais densa. Pode parecer inconsistente.
7. **CTAs primários** alternam entre `#1D2235` (preto-azulado) e `#4A7AB5` (blue) sem regra clara — `Button variant="blue"` no submit, `#1D2235` em sub-editores.
8. **Sub-editores** (Galeria, Variações, BOM, Calculadora) vivem dentro do mesmo `<form>` do produto principal — recém-corrigido o bug de forms aninhados, mas a navegação ainda é "scroll vertical infinito".

---

**Caminho do arquivo:** `docs/ui-snapshots/admin-product-form.md`
