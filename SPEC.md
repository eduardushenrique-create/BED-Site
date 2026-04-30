# Especificação: Página de Detalhes do Pedido - Admin

## Visão Geral
Página dedicada paravisualização completa e gerenciamento de um pedido específico.

## URL
`/admin/pedidos/[id]`

## Elementos da Página

### Header
- Número do pedido (ex: B&D-L1X2A3-ABCD)
- Data de criação do pedido
- Status do pedido com badge colorido
- Botão para retornar à lista

### Seção: Informações do Cliente
- Nome completo
- E-mail
- Telefone
- Endereço de entrega completo (rua, número, complemento, bairro, cidade, UF, CEP)

### Seção: Itens do Pedido
- Lista de produtos com:
  - Nome do produto
  - Quantidade
  - Preço unitário
  - Preço total (quantidade × preço)
- Subtotal
- Frete
- Desconto (se aplicado)
- **Total geral** (destaque visual)

### Seção: Personalização (se aplicável)
- Nome personalizationData existe
- Exibir campos de personalização do pedido
- Texto personalizado, Fonte, Cor, etc.

### Seção: Pagamento
- Status do pagamento (Pendente/Aprovado/Recusado/Estornado)
- Método de pagamento (Cartão, PIX, Boleto)
- ID da transação no gateway
- Data do pagamento
- Valor pago

### Seção: Status & Logística
- Status de fulfillment (Pendente → Produção → Enviado → Entregue)
- Histórico de status com data/hora
- Código de rastreamento (se enviado)
- Transportadora
- Link para rastrear

### Seção: Ações do Admin
- Atualizar status do pedido (dropdown com opções)
- Atualizar status de pagamento
- Gerar/atualizar código de rastreamento
- Enviar e-mail para cliente (botão)
- Cancelar pedido (com confirmação)
- Imprimir nota fiscal / etiqueta

## Funcionalidades Interativas
- Dropdown para mudar status de fulfillment
- Formulário para adicionar código de rastreamento
- Modal de confirmação para cancelamento
- Botão para copiar código de rastreamento

## Design
- Layout em duas colunas (info cliente/esquerda, itens/pagamento/direita)
- Cards para cada seção com sombra sutil
- Cores consistentes com o admin (fundo #F5F2EE, branco para cards)
- Tipografia: mesma do admin

## Dados Mock
Criar dados de exemplo completos incluindo:
- Endereço completo
- Personalização (texto, fonte, cor)
- Histórico de status
- Informações de pagamento