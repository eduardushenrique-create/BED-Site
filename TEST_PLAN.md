# Plano de Testes E2E - Forma 3D Admin

## Objetivo
Validar todas as funcionalidades administrativas do e-commerce com armazenamento local (in-memory).

---

## Fase 1: Produtos

### 1.1 Cadastrar Novo Produto
- [ ] Acessar `/admin/produtos`
- [ ] Clicar em "+ Novo Produto"
- [ ] Preencher: Nome, Preço, Categoria
- [ ] Clicar em "Criar Produto"
- [ ] Validar que produto aparece na lista

### 1.2 Editar Produto
- [ ] Na lista de produtos, clicar "Editar"
- [ ] Alterar preço
- [ ] Clicar "Salvar"
- [ ] ValidarAlteração na lista

### 1.3 Excluir Produto
- [ ] Clicar "Excluir"
- [ ] Confirmar popup
- [ ] Validar que produto some da lista

### 1.4 Ativar/Inativar Produto
- [ ] Clicar no status do produto
- [ ] Validar mudança de "Ativo" para "Inativo"

### 1.5 Produto Destaque
- [ ] Clicar em "Destaque"
- [ ] Validar mudança

---

## Fase 2: Categorias

### 2.1 Criar Categoria
- [ ] Acessar `/admin/categorias`
- [ ] Clicar "+ Nova categoria"
- [ ] Preencher nome
- [ ] Clicar "Criar categoria"
- [ ] Validar que aparece na lista

### 2.2 Editar Categoria
- [ ] Clicar "Editar"
- [ ] Alterar nome
- [ ] Clicar "Salvar"

### 2.3 Excluir Categoria
- [ ] Clicar "Excluir"
- [ ] Confirmar
- [ ] Validar remoção

### 2.4 Ativar/Inativar
- [ ] Clicar no status
- [ ] Validar Toggle

---

## Fase 3: Pedidos

### 3.1 Criar Pedido Manual
- [ ] Acessar `/admin/pedidos`
- [ ] Clicar "+ Novo Pedido"
- [ ] Preencher todos os campos
- [ ] Clicar "Criar Pedido"
- [ ] Validar que pedido aparece na lista

### 3.2 Alterar Status do Pedido
- [ ] Clicar em "Ver" no pedido criado
- [ ] Alterar status para "Em produção"
- [ ] Clicar "Salvar Alterações"
- [ ] Validar que status mudou

### 3.3 Adicionar Rastreamento
- [ ] No pedido, digitar código de rastreio
- [ ] Clicar "Salvar Alterações"
- [ ] Validar que código aparece

### 3.4 E-mail
- [ ] Clicar no botão "E-mail"
- [ ] Validar que abre cliente de e-mail

### 3.5 WhatsApp
- [ ] Clicar no botão "WhatsApp"
- [ ] Validar que abre WhatsApp Web

### 3.6 Imprimir Etiqueta
- [ ] Clicar "Etiqueta"
- [ ] Validar popup de impressão

### 3.7 Clonar Pedido
- [ ] Clicar "Clonar Pedido"
- [ ] Confirmar
- [ ] Validar novo número criado

### 3.8 Editar Itens
- [ ] Clicar "Editar Itens"
- [ ] Adicionar produto
- [ ] Clicar "Salvar Itens"
- [ ] Validar novo total

### 3.9 Cancelar Pedido
- [ ] Clicar "Cancelar"
- [ ] Confirmar
- [ ] Validar status "Cancelado"

---

## Fase 4: Banners

### 4.1 Criar Banner
- [ ] Acessar `/admin/banners`
- [ ] Clicar "+ Novo Banner"
- [ ] Preencher campos
- [ ] Clicar "Criar Banner"
- [ ] Validar que aparece na lista

### 4.2 Ativar/Desativar
- [ ] Clicar "Ativar" ou "Desativar"
- [ ] Validar mudança de cor/status

### 4.3 Excluir Banner
- [ ] Clicar "Excluir"
- [ ] Confirmar
- [ ] Validar remoção

---

## Fase 5: Fluxo Completo (Integração)

### 5.1 Criar Produto → Criar Pedido
- [ ] Criar produto em `/admin/produtos`
- [ ] Criar pedido em `/admin/pedidos` usando o produto
- [ ] Validar pedido criado

### 5.2 Atualizar Status do Pedido
- [ ] Alterar para "Em produção" → "Enviado" → "Entregue"
- [ ] Validar históricos

---

## Checklist Final

| Feature | Status | Observações |
|--------|--------|-------------|
| CRUD Produtos | [ ] | |
| CRUD Categorias | [ ] | |
| CRUD Pedidos | [ ] | |
| Status/Frete | [ ] | |
| Clone/Edit Itens | [ ] | |
| CRUD Banners | [ ] | |
| E-mail/WhatsApp | [ ] | |
| Impressão Etiqueta | [ ] | |

---

## Bugs Conhecidos a Validar

1. LocalStorage não persiste após refresh (esperado - modo demo)
2. Imagens de produtos precisam URL externa (não há upload)
3. API de productos precisa BD real para integração completa