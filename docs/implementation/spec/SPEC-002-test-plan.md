# SPEC-002 — Plano de Testes Manual

> Versão: 1.0 | Gerado pelo Bloco 5 (QA) | Data: 2026-05-05

## Pré-requisitos

- Aplicação rodando com banco Supabase/Prisma configurado (variáveis de `.env.local`).
- Migration `Product.visibility` aplicada (bloco 1).
- Seed com pelo menos: 1 produto com 3 variantes (cores/preços diferentes), 1 produto sem variantes, 1 produto a ser marcado como "Interno".
- Conta de admin disponível para login.

---

## A. Variação no admin de pedidos

### A1. Criação de produto com variantes

- [ ] Acessar `/admin/produtos` > Novo produto.
- [ ] Preencher nome, preço base, categoria e status "Publicado".
- [ ] Na aba/step de variantes, adicionar 3 variantes com cores distintas e priceDelta diferentes (ex: +0, +10, +20).
- [ ] Salvar. Confirmar que o card do produto exibe "X variações".

### A2. Picker abre no modal "Novo Pedido"

- [ ] Acessar `/admin/pedidos` > clicar "+ Novo Pedido".
- [ ] No campo de busca de produtos, localizar o produto X criado acima.
- [ ] Clicar no card do produto X. Confirmar que `VariantPicker` abre inline (overlay sobre o card).
- [ ] Confirmar que o picker exibe as 3 variações com nome, SKU, estoque, preço efetivo.

### A3. Adicionar variante A

- [ ] No picker, selecionar a Variação A.
- [ ] Confirmar que o picker fecha.
- [ ] Confirmar que a linha de item exibe `"Produto X · Variação A"`.
- [ ] Confirmar que o preço da linha reflete o priceDelta correto (preço base + delta A).

### A4. Adicionar variante B — linha separada

- [ ] Clicar no card do produto X novamente — picker reabre.
- [ ] Selecionar a Variação B.
- [ ] Confirmar que há 2 linhas separadas no pedido: `"Produto X · Variação A"` e `"Produto X · Variação B"`.

### A5. Adicionar variante A novamente — incrementa quantidade

- [ ] Clicar no card do produto X novamente.
- [ ] Selecionar a Variação A novamente.
- [ ] Confirmar que a linha `"Produto X · Variação A"` agora mostra quantidade 2 (não cria linha nova).

### A6. Produto sem variantes — adiciona direto

- [ ] No mesmo modal, buscar um produto SEM variantes.
- [ ] Clicar no card. Confirmar que **não** abre picker — item vai direto para o pedido.
- [ ] Confirmar que a linha exibe apenas o nome do produto (sem sufixo de variação).

### A7. Salvar e reabrir pedido

- [ ] Preencher dados do cliente e endereço.
- [ ] Clicar "Criar Pedido". Confirmar que não há erro (alert de sucesso ou redirect).
- [ ] Na lista de pedidos, localizar o novo pedido e clicar "Ver".
- [ ] Em `/admin/pedidos/[id]`, no card "Itens do Pedido", confirmar que cada linha exibe `"Produto · Variação"` corretamente.

### A8. Modal "Editar Itens" — variações preservadas

- [ ] Na página do pedido, clicar "Editar Itens".
- [ ] Confirmar que os itens existentes aparecem com o nome composto `"Produto · Variação"`.
- [ ] Alterar a quantidade de um item com variação. Confirmar que `variantId` é preservado no payload enviado ao `PUT /api/pedidos`.
- [ ] Salvar. Recarregar a página. Confirmar que a variação ainda está correta.

### A9. Variante esgotada — badge, não bloqueio

- [ ] Editar a Variação C para `stockQuantity: 0` e `isAvailable: false`.
- [ ] No modal "Novo Pedido", clicar no produto X — picker abre.
- [ ] Confirmar que a Variação C exibe o badge `"Esgotado · admin pode forçar"` em vermelho.
- [ ] Clicar na Variação C. Confirmar que ela é adicionada ao pedido (admin não é bloqueado).

### A10. Validação server-side — variantId obrigatório

- [ ] Executar a requisição abaixo (substituir auth cookie/header válido):
  ```bash
  curl -X POST http://localhost:3000/api/pedidos \
    -H "Content-Type: application/json" \
    -H "Cookie: <admin-session>" \
    -d '{
      "customerName": "Teste QA",
      "customerEmail": "qa@test.com",
      "items": [{"productId": "<id-produto-com-variantes>", "quantity": 1}]
    }'
  ```
- [ ] Confirmar resposta `HTTP 400` com `{"error": "Selecione uma variação para <nome>"}`.

### A11. Validação server-side — variantId inválido

- [ ] Mesmo endpoint, enviar `variantId: "id-inexistente"`.
- [ ] Confirmar resposta `HTTP 400` com `{"error": "Variação inválida"}`.

---

## B. Variações no site público (regressão)

> Estes fluxos não foram alterados pela SPEC-002. Validar que nada quebrou.

### B1. Página de produto com variantes exige seleção

- [ ] Acessar `/produtos/<slug-produto-com-variantes>` deslogado.
- [ ] Confirmar que o botão "Adicionar ao carrinho" está desabilitado até que uma variante seja selecionada.
- [ ] Selecionar uma variante. Confirmar que o botão habilita.

### B2. Duas variantes no carrinho — linhas separadas

- [ ] Adicionar Variação A ao carrinho.
- [ ] Voltar à página do produto. Selecionar Variação B e adicionar.
- [ ] Abrir o carrinho. Confirmar que há 2 linhas distintas.

### B3. Checkout grava variantId correto

- [ ] Prosseguir com o checkout após B2 (com ambiente de teste/mock payment).
- [ ] Após confirmação, checar o pedido gerado em `/admin/pedidos/[id]`.
- [ ] Confirmar que os `OrderItem.variantId` batem com as variações escolhidas.

---

## C. Produto interno

### C1. Badge "Interno" no admin

- [ ] Acessar `/admin/produtos`.
- [ ] Abrir formulário de edição do produto Y.
- [ ] No campo Visibilidade, selecionar "Interno". Salvar.
- [ ] Confirmar que o card do produto Y exibe o badge "Interno" (fundo laranja/âmbar).

### C2. Produto interno não aparece em `/produtos`

- [ ] Em aba anônima (sem login), acessar `/produtos`.
- [ ] Confirmar que o produto Y não está listado.

### C3. Slug direto retorna 404

- [ ] Acessar `/produtos/<slug-do-produto-Y>` sem login.
- [ ] Confirmar que a página retorna 404 (não exibe dados do produto).

### C4. API pública não retorna produto interno

- [ ] `GET /api/products` — confirmar que Y não está no array de resposta.
- [ ] `GET /api/products?search=<nome-de-Y>` — confirmar array vazio ou sem Y.
- [ ] `GET /api/products?category=<categoria-de-Y>` — confirmar que Y não aparece.

### C5. POST /api/orders rejeita produto interno

- [ ] Obter o `productId` de Y.
- [ ] Com usuário logado (não admin), executar:
  ```bash
  curl -X POST http://localhost:3000/api/orders \
    -H "Content-Type: application/json" \
    -H "Cookie: <user-session>" \
    -d '{
      "customerName": "QA Test",
      "customerEmail": "qa@test.com",
      "customerPhone": "11999999999",
      "customerCpf": "12345678909",
      "zipCode": "01001000",
      "street": "Rua Teste", "number": "1",
      "complement": "", "neighborhood": "Centro",
      "city": "São Paulo", "state": "SP",
      "items": [{"productId": "<id-Y>", "productName": "Y", "variantId": null, "variantName": null, "quantity": 1, "unitPrice": 99, "personalization": null}],
      "shippingMethod": "sedex",
      "paymentMethod": "pix"
    }'
  ```
- [ ] Confirmar `HTTP 400` com `{"error": "Um item do carrinho não está disponível."}`.

### C6. POST /api/products/restock-alerts retorna 404 para produto interno

- [ ] Executar (sem auth — endpoint público):
  ```bash
  curl -X POST http://localhost:3000/api/products/restock-alerts \
    -H "Content-Type: application/json" \
    -d '{"email": "qa@test.com", "productId": "<id-Y>", "turnstileToken": "test"}'
  ```
- [ ] Confirmar `HTTP 404` com `{"error": "Produto não encontrado."}`.
  > Nota: em ambiente local sem Turnstile configurado, o token pode falhar antes de chegar na checagem de visibilidade. Nesse caso, validar a lógica inspecionando o código em `/api/products/restock-alerts/route.ts` linha 54.

### C7. Admin pode adicionar produto interno a pedido

- [ ] Em `/admin/pedidos` > "+ Novo Pedido", buscar pelo nome do produto Y.
- [ ] Confirmar que Y aparece na lista de produtos disponíveis para seleção.
- [ ] Adicionar Y ao pedido. Salvar. Confirmar sucesso.

### C8. Fulfillment e pagamento de pedido com produto interno

- [ ] No pedido criado em C7, alterar `paymentStatus` para "Pago" e `fulfillmentStatus` para "Em produção".
- [ ] Confirmar que a atualização é salva sem erro.

### C9. Reverter para "Público" — produto reaparece

- [ ] Editar produto Y em `/admin/produtos`, alterar Visibilidade para "Público". Salvar.
- [ ] Em aba anônima, acessar `/produtos`. Confirmar que Y aparece na listagem.
- [ ] Acessar `/produtos/<slug-Y>`. Confirmar que página carrega corretamente.

### C10. Filtro "Internos" no admin

- [ ] Em `/admin/produtos`, clicar no chip "Internos" na barra de filtros.
- [ ] Confirmar que apenas produtos com `visibility: 'internal'` são exibidos.
- [ ] Confirmar que o contador do chip bate com o número real de produtos internos.

### C11. AuditLog registra mudança de visibilidade

- [ ] Com acesso ao banco, executar:
  ```sql
  SELECT action, summary, "createdAt", "actorEmail"
  FROM "AuditLog"
  WHERE action = 'product.visibility.change'
  ORDER BY "createdAt" DESC
  LIMIT 5;
  ```
- [ ] Confirmar que as mudanças realizadas nos testes C1 e C9 aparecem nos registros, com `summary` no formato `"Produto <nome>: visibilidade public → internal"` (e o inverso).

---

## Casos de borda e adversariais

### D1. Produto com variantes via cliente — sem variantId no checkout

- [ ] Adicionar produto com variantes ao carrinho do site SEM selecionar variação (forçar via DevTools editando o localStorage do carrinho).
- [ ] Tentar prosseguir com o checkout.
- [ ] Confirmar que `POST /api/orders` retorna 400 com mensagem de variação obrigatória.

### D2. Pedido antigo sem variantId

- [ ] Se houver pedidos históricos (sem variantId nos itens), acessar um em `/admin/pedidos/[id]`.
- [ ] Confirmar que a página carrega sem erro (sem crash de `.variantId is null`).
- [ ] Confirmar que a linha de item exibe apenas o `productName` sem sufixo.

### D3. Submit duplo no modal "Criar Pedido"

- [ ] Preencher o modal de novo pedido completamente.
- [ ] Clicar "Criar Pedido" duas vezes rapidamente.
- [ ] Confirmar que apenas 1 pedido é criado (verificar na lista).

### D4. Produto deletado mas com variantId em pedido existente

- [ ] Deletar produto X do admin.
- [ ] Acessar pedido antigo que tinha uma variação de X.
- [ ] Confirmar que a página não crasha (variantName ou fallback são exibidos).
