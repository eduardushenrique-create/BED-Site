# SPEC-004 — Pipeline de Produção — Plano de Testes Manual

> Versão: 1.0 | Bloco 3 (QA) | Data: 2026-05-05

## Objetivo

Validar o novo fluxo de fases entre pagamento e produção, a auto-transição
disparada pelo pagamento, os controles de avançar/voltar no admin, a linha
do tempo de timestamps, e a regra de notificação ao cliente (cliente só
recebe e-mail nas 3 fases sensíveis).

## Pré-requisitos

- Aplicação rodando com banco Postgres configurado e migration
  `20260525000000_order_production_pipeline` aplicada (`npx prisma migrate deploy`).
- Conta de admin com acesso ao painel.
- Pelo menos 1 cliente com e-mail real ou caixa de teste (Mailhog,
  Mailtrap, Resend dev) para conferir notificações.
- Chave/sandbox do Mercado Pago configurada (para o teste do webhook
  automático). Se não houver, usar atalho do passo A2 (atualização manual
  via admin).
- Pelo menos 1 produto público disponível para criar pedidos.

## Glossário rápido das fases novas

| Fase                        | Quando o pedido entra aqui                            |
| --------------------------- | ----------------------------------------------------- |
| `aguardando_producao`       | Logo após pagamento aprovado (auto-transição)         |
| `em_revisao`                | Admin clicou Avançar — está revisando o pedido        |
| `arte_em_montagem`          | Admin clicou Avançar — montando arte/preparando STL   |
| `liberado_producao`         | Admin clicou Avançar — pedido pronto pra entrar na fila|
| `in_production`             | Admin clicou Avançar — produção começou (notifica)    |
| `ready_to_ship` → `shipped` → `delivered` | fluxo igual ao anterior                |

---

## A. Auto-transição quando o pagamento é aprovado

### A1. Webhook do Mercado Pago dispara auto-transição

- [ ] Criar um pedido novo no site público com método Pix ou cartão.
- [ ] Aprovar o pagamento (em sandbox, simular o pagamento aprovado).
- [ ] Aguardar o webhook do Mercado Pago chegar (logs do servidor mostram
      `payment update`).
- [ ] Em `/admin/pedidos`, abrir o pedido. Confirmar que `paymentStatus = paid`
      e que `fulfillmentStatus = aguardando_producao` (não mais `pending`).
- [ ] Confirmar que o card "Linha do Tempo" mostra a entrada
      "Aguardando produção" com timestamp recente.

### A2. Pagamento manual marcado pelo admin também dispara auto-transição

- [ ] Criar um pedido manual em `/admin/pedidos` > "+ Novo Pedido".
      O pedido nasce com `paymentStatus = pending`, `fulfillmentStatus = pending`.
- [ ] Abrir o pedido. No card "Pagamento", mudar o select para "Pago"
      e clicar "Salvar Alterações".
- [ ] Confirmar que `fulfillmentStatus` virou `aguardando_producao`
      automaticamente (badge no header muda).
- [ ] Confirmar que a Linha do Tempo registrou o timestamp de
      "Aguardando produção".

### A3. Auto-transição NÃO acontece se o pedido já saiu de `pending`

- [ ] Pegar um pedido em fase posterior (ex: `in_production`) e que
      ainda está com `paymentStatus = pending` (cenário hipotético, criado
      manualmente para teste).
- [ ] Marcar pagamento como "Pago".
- [ ] Confirmar que `fulfillmentStatus` permanece em `in_production`
      (auto-transição só atua quando `pending` → outra fase).

### A4. Auto-transição NÃO acontece em pedido cancelado

- [ ] Pegar um pedido com `status = cancelled`.
- [ ] Tentar marcar como pago.
- [ ] Confirmar que nada muda no fulfillment.

---

## B. Avançar e voltar fases pelo admin

### B1. Avançar um pedido por todas as fases novas

> Use um pedido em `aguardando_producao` (criado em A1 ou A2).

- [ ] Em `/admin/pedidos`, clicar "Ver" no pedido.
- [ ] No card "Pipeline de Produção", clicar **Avançar para Em revisão →**.
- [ ] Confirmar que o badge mudou para "Em revisão" e que a Linha do
      Tempo agora tem 2 entradas (Aguardando produção + Em revisão).
- [ ] Repetir: avançar para "Arte em montagem".
- [ ] Repetir: avançar para "Liberado para produção".
- [ ] Repetir: avançar para "Em produção" (este é o ponto que **dispara
      e-mail ao cliente** — ver seção D).
- [ ] Repetir: avançar para "Pronto para envio".
- [ ] Confirmar que a Linha do Tempo lista as 6 entradas em ordem
      cronológica, com timestamps coerentes.

### B2. Avançar pela lista (botão na linha)

- [ ] Em `/admin/pedidos`, localizar um pedido fora dos status terminais.
- [ ] Clicar no botão **"Avançar →"** na coluna "Ações".
- [ ] Confirmar que a página recarrega e o badge da coluna "Fase Atual"
      mudou para a próxima fase.
- [ ] Confirmar que o pedido também avançou no detalhe (consistência).

### B3. Modal de nota — avançar SEM nota

- [ ] No detalhe de um pedido, clicar **Avançar para [próxima fase]**.
- [ ] No modal, deixar o campo "Nota da fase" em branco.
- [ ] Clicar "Confirmar avanço".
- [ ] Confirmar que o pedido avançou. Confirmar que o card "Pipeline"
      NÃO exibe a tarja "Nota da fase atual".

### B4. Modal de nota — avançar COM nota

- [ ] No detalhe de um pedido, clicar **Avançar para [próxima fase]**.
- [ ] No modal, preencher a textarea com algo como "Arte aprovada por
      WhatsApp pelo cliente em 05/05".
- [ ] Confirmar avanço.
- [ ] Após o reload, confirmar que aparece a tarja azul "Nota da fase
      atual" no card Pipeline com o texto digitado.

### B5. Nota é substituída ao avançar de novo

- [ ] No mesmo pedido (com nota da B4), clicar Avançar novamente,
      digitar uma nota diferente (ex: "Slicing OK").
- [ ] Confirmar que a tarja agora mostra a nova nota e a antiga sumiu.
- [ ] Avançar mais uma vez SEM preencher nota.
- [ ] Confirmar que a tarja desapareceu (nota foi limpa para `null`).

### B6. Voltar uma fase pelo detalhe

- [ ] Em um pedido em `arte_em_montagem`, clicar **← Voltar para Em revisão**.
- [ ] Confirmar que o badge retornou para "Em revisão".
- [ ] Confirmar que a Linha do Tempo **mantém** o timestamp anterior de
      "Em revisão" e adiciona um novo (atualiza o timestamp para o
      momento do retorno).
      > Comportamento esperado: `withTimelineStamp` sobrescreve a entrada
      > existente para a fase. Se preferir manter histórico de revisitas,
      > registrar como issue de evolução.

### B7. Voltar uma fase pela lista

- [ ] Em `/admin/pedidos`, localizar um pedido em qualquer fase
      intermediária (não-pending, não-cancelled).
- [ ] Clicar no botão **"←"** na coluna "Ações".
- [ ] Confirmar que a fase regrediu.

### B8. Bloqueio: avançar além de `delivered`

- [ ] Pegar (ou criar) um pedido em `delivered`.
- [ ] No detalhe, confirmar que **NÃO aparece** o card "Pipeline de
      Produção" com botão Avançar (porque `canAdvance(delivered) === false`).
- [ ] Tentar avançar via API direta:
  ```bash
  curl -X PUT http://localhost:3000/api/pedidos \
    -H "Content-Type: application/json" \
    -H "Cookie: <admin-session>" \
    -d '{"id": "<id-pedido-delivered>", "action": "advance_stage"}'
  ```
- [ ] Confirmar `HTTP 400` com `{"error": "Pedido já está na última fase ou não pode avançar"}`.

### B9. Bloqueio: pedido cancelado não avança nem volta

- [ ] Pegar um pedido com `status = cancelled`.
- [ ] No detalhe, confirmar que o card "Pipeline" não exibe os botões.
- [ ] Tentar via API:
  ```bash
  curl -X PUT http://localhost:3000/api/pedidos \
    -H "Content-Type: application/json" \
    -H "Cookie: <admin-session>" \
    -d '{"id": "<id-pedido-cancelled>", "action": "advance_stage"}'
  ```
- [ ] Confirmar `HTTP 400` (`getNextStage` retorna `null` para `cancelled`).
- [ ] Repetir com `regress_stage` — também `400`.

### B10. Bloqueio: pedido em `pending` não pode regredir

- [ ] Em um pedido recém-criado (`pending`), confirmar que o card
      "Pipeline" só mostra o botão Avançar (não há botão Voltar — `canRegress(pending) === false`).
- [ ] Tentar via API:
  ```bash
  curl -X PUT http://localhost:3000/api/pedidos \
    -H "Content-Type: application/json" \
    -H "Cookie: <admin-session>" \
    -d '{"id": "<id-pedido-pending>", "action": "regress_stage"}'
  ```
- [ ] Confirmar `HTTP 400`.

---

## C. Linha do Tempo

### C1. Pedido novo (a partir desta migration) tem timeline preenchida

- [ ] Pegar um pedido criado depois do bloco 1 deste pipeline.
- [ ] Avançar até `delivered` (use os passos B1).
- [ ] Confirmar que a Linha do Tempo mostra todas as entradas em ordem
      cronológica do mais antigo para o mais recente, com data e hora.

### C2. Pedido antigo (anterior à migration) mostra "—"

- [ ] Pegar um pedido criado ANTES do bloco 1 (productionTimeline = null).
- [ ] Abrir o detalhe.
- [ ] Confirmar que o card "Linha do Tempo" exibe `—` e o texto explicativo
      "Pedidos anteriores ao novo fluxo de pipeline não têm timeline registrada."
- [ ] Confirmar que avançar/voltar este pedido a partir de agora **começa
      a preencher a timeline** dali pra frente.

### C3. Ordem cronológica está correta

- [ ] Em um pedido com várias fases registradas, abrir a Linha do Tempo.
- [ ] Comparar os timestamps entre si — o de baixo deve ser mais recente
      que o de cima.

---

## D. Notificações ao cliente

> Configurar Resend (ou caixa de teste) para receber os e-mails. O
> e-mail vai para `customerEmail` do pedido.

### D1. Cliente NÃO recebe e-mail nas fases intermediárias

- [ ] Pegar um pedido em `aguardando_producao`.
- [ ] Avançar para `em_revisao`. Confirmar que **nenhum e-mail** chega.
- [ ] Avançar para `arte_em_montagem`. Confirmar que **nenhum e-mail** chega.
- [ ] Avançar para `liberado_producao`. Confirmar que **nenhum e-mail** chega.
- [ ] Avançar para `in_production`. **AGORA o cliente recebe** o e-mail
      "Pedido em produção" (template `sendOrderInProduction`).

### D2. Cliente recebe e-mail em `shipped` (com tracking)

- [ ] Pegar um pedido em `ready_to_ship`. Avançar para `shipped`.
      O salvamento de tracking pode ser feito junto pelo card "Status & Logística"
      (preencher tracking + mudar fulfillment para `shipped`).
- [ ] Confirmar que o cliente recebe e-mail "Pedido enviado" com link
      do tracking.

### D3. Cliente NÃO recebe e-mail em `ready_to_ship` (sozinho)

- [ ] Em um pedido `liberado_producao`, avançar para `in_production`
      (recebe e-mail — ok). Em seguida, avançar para `ready_to_ship`.
- [ ] Confirmar que **nenhum e-mail** chega na transição para `ready_to_ship`.

### D4. Cliente recebe e-mail em `delivered`

- [ ] Avançar para `delivered`. Confirmar que o cliente recebe e-mail
      "Pedido entregue".

### D5. Cliente recebe e-mail em `paymentStatus = paid` (regressão)

- [ ] Independente do pipeline novo, marcar um pedido como pago (manualmente
      ou via webhook). Confirmar que o e-mail "Pagamento aprovado"
      continua sendo enviado (comportamento prévio mantido).

---

## E. Lista de pedidos — UI nova

### E1. Coluna "Fase Atual" usa o catálogo central

- [ ] Em `/admin/pedidos`, conferir a coluna "Fase Atual".
- [ ] Para cada uma das 9 fases possíveis (pending, aguardando_producao,
      em_revisao, arte_em_montagem, liberado_producao, in_production,
      ready_to_ship, shipped, delivered) o badge deve usar o label PT-BR
      e a cor do `lib/order-statuses.ts`.

### E2. Filtro por fase aceita as fases novas

- [ ] No select "Todas as fases", confirmar que aparecem as 9 opções +
      Cancelado.
- [ ] Selecionar "Aguardando produção". Confirmar que a tabela só
      mostra pedidos nessa fase.
- [ ] Repetir para "Em revisão", "Arte em montagem", "Liberado para
      produção".

### E3. Card "Aguardando Produção" no topo

- [ ] Confirmar que o card "Aguardando Produção" aparece no sumário
      (entre "Pagos" e "Produção").
- [ ] Conferir que a contagem bate com o número real de pedidos em
      `aguardando_producao`.
- [ ] Mover um pedido manualmente de `aguardando_producao` para
      `em_revisao` — após reload, o card deve diminuir em 1.

### E4. Botões "Avançar" e "Voltar" na linha — visibilidade correta

- [ ] Em pedido `pending`: aparece só "Avançar →".
- [ ] Em pedido `aguardando_producao`: aparece "←" + "Avançar →".
- [ ] Em pedido `delivered`: nenhum botão de fase aparece.
- [ ] Em pedido `cancelled`: nenhum botão de fase aparece.

### E5. Acessibilidade — botões têm aria-label

- [ ] Inspecionar (DevTools) os botões "Avançar →" e "←" na lista.
- [ ] Confirmar que cada um tem `aria-label` específico
      (ex: "Avançar para Em revisão", "Voltar para Pendente").

### E6. Loading lock — não permite duplo clique

- [ ] Clicar "Avançar →" em uma linha. Imediatamente clicar de novo na
      mesma linha (ou em outra) antes da resposta voltar.
- [ ] Confirmar que o segundo clique é ignorado (botão fica disabled
      enquanto `pendingActionFor === order.id`).

---

## F. Detalhe do pedido — UI nova

### F1. Card "Pipeline de Produção" só aparece quando faz sentido

- [ ] Pedido `pending`: card aparece, com botão Avançar.
- [ ] Pedido `delivered`: card NÃO aparece.
- [ ] Pedido `cancelled`: card NÃO aparece.

### F2. Botão Avançar mostra o nome da próxima fase

- [ ] Em `aguardando_producao`, confirmar que o botão diz
      "Avançar para Em revisão →".
- [ ] Em `em_revisao`, "Avançar para Arte em montagem →".
- [ ] E assim por diante.

### F3. Botão Voltar mostra o nome da fase anterior

- [ ] Em `arte_em_montagem`, confirmar que o botão diz
      "← Voltar para Em revisão".

### F4. Dropdown manual continua disponível como fallback

- [ ] Confirmar que no card "Status & Logística" o select "Status do
      pedido (avançado)" lista todas as 9 fases + Cancelado.
- [ ] Mudar a fase pelo dropdown e clicar "Salvar Alterações".
- [ ] Confirmar que o status mudou.
- [ ] **Confirmar que NÃO foi adicionado timestamp na Linha do Tempo**
      (porque o dropdown é fallback manual e não passa pela action
      `advance_stage`). O texto explicativo no card deve avisar disso.

---

## G. Auditoria

### G1. Cada avanço/regresso registra entrada de audit

- [ ] Avançar um pedido. Em seguida, no banco:
  ```sql
  SELECT action, summary, "createdAt", "actorEmail"
  FROM "AuditLog"
  WHERE "targetType" = 'Order'
    AND action IN ('order.advance_stage', 'order.regress_stage')
  ORDER BY "createdAt" DESC
  LIMIT 5;
  ```
- [ ] Confirmar que aparece uma linha para o avanço, com `summary` no
      formato `"Pedido <orderNumber>: <de> → <para>"` e o `actorEmail`
      do admin logado.
- [ ] Se houve nota, ela aparece no `summary` truncada em 100 chars.

### G2. Audit do dropdown manual continua usando `order.update`

- [ ] Mudar a fase pelo dropdown manual. Confirmar que o audit registra
      `action = 'order.update'` (não `advance_stage`).

---

## H. Regressões — validar que nada quebrou

### H1. Filtro de pagamento + filtro de fase combinados

- [ ] Aplicar simultaneamente "Pagamento = Pago" e
      "Fase = Aguardando produção". Confirmar que filtra corretamente.

### H2. Exportar CSV com fases novas

- [ ] Aplicar filtro de fase "Aguardando produção". Clicar
      "Exportar CSV (N)".
- [ ] Abrir o CSV gerado. Confirmar que a coluna "Status" mostra os
      valores corretos (string `aguardando_producao`).
- [ ] Confirmar que abrir no Excel não corrompe acentos (BOM UTF-8 ok).

### H3. Editar itens, clonar, estornar — fluxos pré-existentes

- [ ] Em um pedido novo, abrir o modal "Editar Itens". Adicionar/remover
      um item. Salvar. Confirmar que funciona.
- [ ] Clicar "Clonar Pedido". Confirmar que o pedido novo nasce em
      `pending` (não copia a fase do original).
- [ ] Em um pedido pago, clicar "Estornar pagamento". Confirmar que o
      fluxo de estorno funciona como antes.

### H4. "Meus pedidos" do cliente

- [ ] Logar como cliente final em `/meus-pedidos`.
- [ ] Confirmar que o cliente vê os pedidos dele e o status (a página
      do cliente exibe rótulo amigável; pode ainda mostrar a string
      crua das fases novas — se sim, registrar issue de UX para o
      próximo bloco).

---

## I. Casos adversariais

### I1. Race condition — webhook chega depois do admin marcar como pago

- [ ] Cenário: admin marca pago manualmente (auto-transição vai pra
      `aguardando_producao`). Em seguida, o webhook do MP confirma o
      mesmo pedido.
- [ ] Confirmar que a segunda passagem (webhook) **não regredi** o
      pedido — ele já está pago, então o `resolvePaymentTransition`
      retorna `shouldPersistStatus = false`.
- [ ] Confirmar que a fase permanece `aguardando_producao` (não
      duplica timestamp na timeline).

### I2. Avançar via API sem admin logado

- [ ] Sem cookie de admin:
  ```bash
  curl -X PUT http://localhost:3000/api/pedidos \
    -H "Content-Type: application/json" \
    -d '{"id": "<id>", "action": "advance_stage"}'
  ```
- [ ] Confirmar `HTTP 401` (ou similar) — `requireApiAdmin` deve
      bloquear.

### I3. Avançar via API com `id` inexistente

- [ ] Com admin:
  ```bash
  curl -X PUT http://localhost:3000/api/pedidos \
    -H "Content-Type: application/json" \
    -H "Cookie: <admin>" \
    -d '{"id": "id-que-nao-existe", "action": "advance_stage"}'
  ```
- [ ] Confirmar `HTTP 404` com `{"error": "Order not found"}`.

### I4. Nota muito longa no `currentStageNote`

- [ ] Avançar com uma nota de ~5000 caracteres.
- [ ] Confirmar que salva sem truncar (campo é `String?` no Postgres,
      sem limite explícito).
- [ ] No card Pipeline, conferir que a nota é exibida sem quebrar o
      layout (pode rolar/quebrar linha).

---

## Critérios de aceitação do bloco

Para considerar SPEC-004 entregue:

- Seções A, B, C, D, E, F passam 100%.
- Seção G (auditoria) passa.
- Seção H (regressões) passa — exportação CSV, edição, clone, estorno
  e tela do cliente continuam funcionando.
- Itens da seção I são checados; eventuais bugs viram issues separadas
  (não bloqueiam merge se forem cosméticos).
