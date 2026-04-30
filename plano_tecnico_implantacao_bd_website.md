# Plano técnico consolidado de implantação — Website B&D Artes & Impressões

## 1. Resumo executivo

Este documento consolida o planejamento técnico para criação e implantação de um website/e-commerce para **B&D Artes & Impressões**, uma loja brasileira de presentes, objetos personalizados e produtos impressos em 3D.

O projeto deve entregar uma experiência completa de compra online, contemplando:

- Home institucional e comercial.
- Catálogo de produtos.
- Busca, filtros e ordenação.
- Página de detalhe do produto.
- Produtos personalizáveis.
- Carrinho lateral.
- Checkout.
- Cálculo de frete.
- Pagamento via Pix e cartão.
- Confirmação de pedido.
- E-mails transacionais.
- Admin para produtos, pedidos e operação.
- SEO técnico.
- Analytics.
- Páginas legais.
- Monitoramento e checklist de publicação.

A recomendação arquitetural é usar uma stack moderna baseada em:

- **Next.js + TypeScript** para frontend e rotas públicas.
- **Tailwind CSS** para implementação do design system.
- **PostgreSQL + Prisma** para banco de dados e modelagem.
- **API própria no Next.js** para MVP.
- **Mercado Pago, Pagar.me ou Asaas** para pagamentos.
- **Melhor Envio, Frenet ou Kangu** para frete.
- **Resend, SendGrid ou Amazon SES** para e-mails transacionais.
- **Vercel, Render, Railway ou similar** para hospedagem.
- **Sentry + GA4 + GTM + Search Console** para observabilidade e métricas.

---

## 2. Premissas e decisões pendentes

### 2.1 Premissas assumidas

1. O projeto será lançado no Brasil, em português brasileiro.
2. O modelo de negócio é venda direta ao consumidor final.
3. Os produtos são físicos, produzidos via impressão 3D.
4. Parte do catálogo terá produtos personalizáveis.
5. A compra deve permitir Pix e cartão.
6. O site precisa ser responsivo e otimizado para mobile.
7. O MVP deve permitir venda real.
8. O admin deve permitir cadastrar produtos e acompanhar pedidos.
9. A loja deve ter páginas legais, políticas e FAQ.
10. O fluxo de compra deve registrar personalizações no pedido.

### 2.2 Decisões que precisam ser confirmadas

| Decisão | Impacto |
|---|---|
| Nome final da marca | Afeta domínio, SEO, logo, e-mails e políticas. |
| Paleta visual oficial | Há conflito entre uma paleta terracota/off-white/teal e outra azul/navy/rose. |
| Gateway de pagamento | Afeta checkout, webhooks e custos por transação. |
| Provedor de frete | Afeta cálculo de frete, etiquetas e rastreio. |
| Regra de frete grátis | Afeta banners, badges, carrinho e checkout. |
| Política para produtos personalizados | Afeta PDP, checkout, FAQ e trocas/devoluções. |
| Estoque real ou produção sob demanda | Afeta disponibilidade, prazo e operação. |
| Conta do cliente no MVP | Afeta autenticação, escopo e complexidade. |
| Integração fiscal/ERP | Afeta operação pós-venda e emissão de notas. |

---

## 3. Escopo por versão

## 3.1 MVP — versão mínima lançável

Objetivo: publicar uma loja funcional, segura e capaz de vender.

Inclui:

1. Home.
2. Catálogo de produtos.
3. Página de produto.
4. Produto personalizável.
5. Carrinho lateral.
6. Checkout.
7. Cálculo de frete.
8. Pagamento Pix e cartão.
9. Confirmação de pedido.
10. E-mails transacionais.
11. Admin básico.
12. Páginas institucionais.
13. FAQ.
14. Páginas legais.
15. SEO técnico básico.
16. Analytics.
17. Deploy em produção.

### Fora do MVP

1. Conta completa do cliente.
2. Wishlist persistente por login.
3. Preview visual avançado da personalização.
4. Programa de fidelidade.
5. ERP completo.
6. Blog.
7. Recomendações inteligentes.
8. Marketplace.

---

## 3.2 v1 — versão comercial robusta

Inclui:

1. Busca avançada.
2. Filtros completos.
3. Cupons.
4. Favoritos.
5. Avaliações.
6. Produtos relacionados.
7. Recuperação de carrinho.
8. Dashboard operacional.
9. Integração com etiqueta/frete.
10. Integração com e-mail marketing.
11. Relatórios de vendas.
12. Melhorias de SEO por categoria.
13. Tracking de status para o cliente.

---

## 3.3 Futuro

Inclui:

1. Conta do cliente.
2. Histórico de pedidos.
3. Endereços salvos.
4. Preview visual da personalização.
5. Recomendação inteligente de presentes.
6. Programa de fidelidade.
7. Kits recorrentes.
8. Integração com ERP/fiscal.
9. Área de orçamento para peças sob medida.
10. Chatbot de atendimento.
11. Painel de produção.
12. Automação de pós-venda.

---

# 4. Arquitetura recomendada

## 4.1 Classificação do projeto

Tipo: **e-commerce customizado com backoffice operacional**.

Subtipos:

- Website público.
- Loja virtual.
- Sistema administrativo.
- Fluxo operacional de produção personalizada.
- Integrações externas de pagamento, frete, e-mail e analytics.

---

## 4.2 Frontend

### Recomendado

- Next.js.
- TypeScript.
- Tailwind CSS.
- Componentes reutilizáveis.
- Renderização híbrida: SSR/SSG para páginas públicas e client-side para carrinho/checkout.

### Responsabilidades

1. Home.
2. Catálogo.
3. Busca.
4. Página de produto.
5. Carrinho lateral.
6. Checkout.
7. Pedido confirmado.
8. Páginas institucionais.
9. Admin.
10. Integração com APIs internas.

---

## 4.3 Backend/API

### Recomendado para MVP

- Route Handlers ou API Routes no próprio Next.js.

### Recomendado para evolução

- NestJS ou backend separado, se o volume e complexidade crescerem.

### Responsabilidades

1. Produtos.
2. Categorias.
3. Carrinho.
4. Pedidos.
5. Pagamentos.
6. Frete.
7. Cupons.
8. Admin.
9. Webhooks.
10. E-mails.
11. Autenticação.
12. Auditoria.

---

## 4.4 Banco de dados

### Recomendado

- PostgreSQL.
- Prisma ORM.

### Opções de hospedagem

- Supabase.
- Neon.
- Railway.
- Render.
- AWS RDS.

---

## 4.5 Storage

### Recomendado

- Cloudflare R2.
- Supabase Storage.
- AWS S3.

### Uso

1. Imagens de produto.
2. Imagens de variações.
3. Assets públicos.
4. Arquivos de referência da operação, se necessário.

---

## 4.6 Autenticação

### MVP

- Login administrativo.
- Cliente sem conta obrigatória.

### v1

- Conta do cliente.
- Histórico de pedidos.
- Favoritos persistentes.
- Endereços salvos.

### Opções

- Supabase Auth.
- Auth.js.
- Clerk.
- Firebase Auth.

---

## 4.7 Pagamento

### Opções recomendadas

1. Mercado Pago.
2. Pagar.me.
3. Asaas.
4. Iugu.

### Métodos mínimos

1. Pix.
2. Cartão.

### Métodos opcionais

1. Boleto.
2. Link de pagamento.
3. Dois cartões.

---

## 4.8 Frete

### Opções recomendadas

1. Melhor Envio.
2. Frenet.
3. Kangu.
4. Correios API.

### Funcionalidades

1. Cotação por CEP.
2. Exibição de prazo.
3. Separação entre prazo de produção e prazo de transporte.
4. Frete grátis por regra.
5. Código de rastreio.
6. Etiqueta, na v1.

---

## 4.9 E-mail transacional

### Opções

1. Resend.
2. SendGrid.
3. Amazon SES.
4. Mailgun.

### E-mails mínimos

1. Pedido recebido.
2. Pagamento aprovado.
3. Pedido em produção.
4. Pedido enviado.
5. Pedido cancelado.
6. Recuperação de carrinho, na v1.

---

## 4.10 Observabilidade

### MVP

1. Sentry.
2. Logs básicos.
3. Monitoramento de uptime.
4. Alertas de erro crítico.

### v1

1. Better Stack.
2. Dashboards de erros.
3. Monitoramento de filas.
4. Monitoramento de webhooks.
5. Métricas de checkout.

---

## 4.11 Ambientes

1. Local.
2. Desenvolvimento.
3. Staging/homologação.
4. Produção.

### Regras

- Staging deve usar sandbox de pagamento.
- Produção deve usar credenciais reais.
- Variáveis devem ser separadas por ambiente.
- Nunca versionar segredos no repositório.

---

# 5. Modelo de dados inicial

## 5.1 Product

Campos:

- id
- name
- slug
- sku
- shortDescription
- description
- price
- compareAtPrice
- status
- isActive
- isFeatured
- isPersonalizable
- productionTimeMinDays
- productionTimeMaxDays
- weightGrams
- widthCm
- heightCm
- depthCm
- createdAt
- updatedAt

Relacionamentos:

- Product → Category
- Product → ProductImage
- Product → ProductVariant
- Product → PersonalizationField
- Product → Review
- Product → OrderItem

---

## 5.2 Category

Campos:

- id
- name
- slug
- description
- seoTitle
- seoDescription
- sortOrder
- isActive

Categorias iniciais:

- Decoração.
- Cozinha.
- Escritório.
- Infantil.
- Pets.
- Casamento.
- Aniversário.

---

## 5.3 ProductImage

Campos:

- id
- productId
- url
- alt
- sortOrder
- isMain

---

## 5.4 ProductVariant

Campos:

- id
- productId
- name
- sku
- color
- size
- material
- finish
- priceDelta
- stockQuantity
- isAvailable

---

## 5.5 PersonalizationField

Campos:

- id
- productId
- label
- type
- placeholder
- helpText
- isRequired
- minLength
- maxLength
- sortOrder

Tipos:

- text
- textarea
- date
- select
- color
- number

---

## 5.6 Cart

Campos:

- id
- sessionId
- userId
- couponCode
- createdAt
- updatedAt

---

## 5.7 CartItem

Campos:

- id
- cartId
- productId
- variantId
- quantity
- unitPrice
- personalizationJson

---

## 5.8 Order

Campos:

- id
- orderNumber
- customerName
- customerEmail
- customerPhone
- customerCpf
- status
- paymentStatus
- fulfillmentStatus
- subtotal
- discountTotal
- shippingTotal
- total
- shippingMethod
- trackingCode
- productionDeadline
- createdAt
- updatedAt

---

## 5.9 OrderItem

Campos:

- id
- orderId
- productId
- variantId
- productNameSnapshot
- skuSnapshot
- quantity
- unitPrice
- total
- personalizationJson

Regra importante: salvar snapshots de nome, SKU, preço e personalização no momento da compra.

---

## 5.10 Address

Campos:

- id
- orderId
- zipCode
- street
- number
- complement
- neighborhood
- city
- state
- country

---

## 5.11 Payment

Campos:

- id
- orderId
- provider
- providerPaymentId
- method
- status
- amount
- pixQrCode
- pixCopyPaste
- paidAt
- rawPayload

---

## 5.12 Shipment

Campos:

- id
- orderId
- provider
- serviceName
- price
- estimatedDays
- trackingCode
- labelUrl
- status

---

## 5.13 Coupon

Campos:

- id
- code
- type
- value
- minSubtotal
- startsAt
- endsAt
- usageLimit
- usedCount
- isActive

---

## 5.14 AdminUser

Campos:

- id
- name
- email
- role
- passwordHash ou authProviderId
- createdAt

Papéis:

- owner
- admin
- production
- support

---

# 6. Telas, fluxos e funcionalidades

## 6.1 Home

### Objetivo

Comunicar rapidamente que a loja vende presentes personalizados impressos em 3D e conduzir o usuário para produtos ou personalização.

### Seções

1. Header.
2. Hero.
3. Chamada da marca.
4. CTA principal.
5. CTA secundário.
6. Categorias em destaque.
7. Produtos mais vendidos.
8. Produtos novos.
9. Seção de personalização.
10. Benefícios.
11. Depoimentos.
12. FAQ curto.
13. CTA final.
14. Footer.

### Funcionalidades

- Hero com imagem.
- Vitrine de produtos.
- Cards de categoria.
- CTAs para catálogo e personalizados.
- Prova social.
- Destaques de benefícios.

### Estados

- Loading.
- Erro ao carregar produtos.
- Vitrine vazia.
- Mobile.
- Desktop.

---

## 6.2 Header

### Funcionalidades

1. Logo clicável.
2. Navegação desktop.
3. Menu mobile.
4. Busca.
5. Carrinho com contador.
6. Link para contato/WhatsApp.
7. Barra promocional opcional.

### Menu sugerido

- Início.
- Produtos.
- Personalizados.
- Presentes.
- Sobre.
- Contato.

### Estados

- Desktop.
- Mobile.
- Menu aberto.
- Busca ativa.
- Carrinho com zero itens.
- Carrinho com itens.
- Foco por teclado.

---

## 6.3 Listagem de produtos

### Funcionalidades

1. Grid de produtos.
2. Filtros por categoria.
3. Filtro por status.
4. Filtro por preço.
5. Filtro por personalização.
6. Filtro por disponibilidade.
7. Ordenação.
8. Busca.
9. Paginação ou carregamento incremental.
10. Estado vazio.
11. Estado loading.
12. Estado erro.

### Filtros iniciais

- Decoração.
- Cozinha.
- Escritório.
- Infantil.
- Pets.
- Casamento.
- Aniversário.
- Novo.
- Promoção.
- Mais vendido.
- Personalizável.
- Frete grátis.
- Esgotado.

### Ordenação

- Mais vendidos.
- Lançamentos.
- Menor preço.
- Maior preço.

---

## 6.4 Card de produto

### Elementos

1. Imagem.
2. Badge.
3. Botão de favorito.
4. Nome.
5. Preço atual.
6. Preço antigo riscado.
7. Badge de desconto.
8. Estado esgotado.
9. Indicação de personalização.
10. CTA rápido opcional.

### Estados

- Default.
- Hover.
- Active.
- Loading.
- Sem imagem.
- Esgotado.
- Promoção.
- Favoritado.

---

## 6.5 Página de produto

### Funcionalidades

1. Galeria de imagens.
2. Imagem principal.
3. Miniaturas.
4. Nome.
5. SKU.
6. Preço atual.
7. Preço antigo.
8. Badge de desconto.
9. Badge de status.
10. Descrição curta.
11. Descrição completa.
12. Variações.
13. Campos de personalização.
14. Quantidade.
15. Cálculo de frete por CEP.
16. Prazo de produção.
17. CTA “Adicionar ao carrinho”.
18. CTA “Comprar agora”.
19. Favoritar.
20. Compartilhar.
21. Accordion de detalhes.
22. Produtos relacionados.
23. Reviews, na v1.

### Validações

- Produto esgotado bloqueia compra.
- Campo obrigatório de personalização bloqueia compra.
- Quantidade não pode exceder estoque.
- CEP inválido exibe erro.
- Variação indisponível desabilita CTA.

---

## 6.6 Carrinho lateral

### Funcionalidades

1. Abrir ao adicionar produto.
2. Fechar por botão.
3. Fechar por overlay.
4. Fechar por ESC.
5. Listar itens.
6. Mostrar imagem.
7. Mostrar nome.
8. Mostrar variação.
9. Mostrar personalização.
10. Alterar quantidade.
11. Remover item.
12. Mostrar subtotal.
13. Mostrar desconto.
14. Mostrar frete estimado.
15. Campo de cupom.
16. CTA “Finalizar compra”.
17. CTA “Continuar comprando”.

### Estados

- Vazio.
- Com itens.
- Loading.
- Erro.
- Item indisponível.
- Produto com personalização.

---

## 6.7 Checkout

### Etapas

1. Identificação.
2. Entrega.
3. Frete.
4. Pagamento.
5. Revisão.
6. Confirmação.

### Campos

- Nome.
- E-mail.
- Telefone.
- CPF.
- CEP.
- Endereço.
- Número.
- Complemento.
- Bairro.
- Cidade.
- Estado.
- Cupom.

### Regras

- CPF obrigatório.
- E-mail válido obrigatório.
- CEP válido obrigatório.
- Frete selecionado obrigatório.
- Pagamento aprovado ou pendente gera pedido conforme método.
- Pix pode criar pedido pendente até confirmação via webhook.
- Cartão recusado não deve criar pedido aprovado.
- Personalização precisa aparecer no resumo.

---

## 6.8 Pedido confirmado

### Conteúdo

1. Mensagem de sucesso.
2. Número do pedido.
3. Status do pagamento.
4. Resumo dos itens.
5. Dados de entrega.
6. Prazo de produção.
7. Próximos passos.
8. CTA para continuar comprando.
9. CTA para atendimento.

---

## 6.9 Admin

### Módulos do MVP

1. Login.
2. Dashboard simples.
3. Produtos.
4. Categorias.
5. Pedidos.
6. Personalizações.
7. Status de produção.
8. Configurações básicas.

### Status recomendados

1. pedido recebido;
2. pagamento pendente;
3. pagamento aprovado;
4. em produção;
5. produzido;
6. enviado;
7. entregue;
8. cancelado;
9. reembolsado.

---

# 7. Requisitos não funcionais

## 7.1 Performance

1. Imagens otimizadas.
2. Lazy loading.
3. CDN.
4. Cache para páginas públicas.
5. Redução de scripts de terceiros.
6. SSR/SSG para páginas públicas.
7. Core Web Vitals monitorados.

## 7.2 Acessibilidade

1. Foco visível.
2. Navegação por teclado.
3. Labels em inputs.
4. `aria-label` em ícones.
5. Contraste validado.
6. Drawer com foco preso.
7. ESC fecha modal/drawer.
8. Erros associados aos campos.
9. Não depender apenas de cor.

## 7.3 SEO

1. URL amigável.
2. Title e description por página.
3. Schema Product.
4. Schema FAQPage.
5. Schema Organization.
6. Breadcrumbs.
7. Sitemap.
8. Robots.txt.
9. Canonical.
10. Open Graph.
11. Alt text nas imagens.

## 7.4 Segurança

1. Validação server-side.
2. Rate limit em checkout, login e contato.
3. Proteção CSRF quando aplicável.
4. Sanitização de inputs.
5. Webhooks com assinatura.
6. Segredos em variáveis de ambiente.
7. Logs sem dados sensíveis.
8. Backups.
9. Permissões no admin.
10. LGPD.

## 7.5 Manutenibilidade

1. TypeScript obrigatório.
2. Componentes reutilizáveis.
3. Tokens centralizados.
4. Testes unitários.
5. Testes E2E.
6. Documentação de setup.
7. Runbook de deploy.
8. Runbook de rollback.

---

# 8. Plano por fases

## Fase 0 — Discovery e decisões críticas

### Objetivo

Fechar decisões que afetam arquitetura, escopo, custo e identidade.

### Entregáveis

- Nome final da marca.
- Paleta oficial.
- Escopo MVP.
- Regras de produto personalizado.
- Regras de frete.
- Regras de troca.
- Provedor de pagamento.
- Provedor de frete.
- Domínio.

### Critérios de aceite

- Nenhum arquivo ou tela usa nome placeholder.
- Paleta final documentada.
- Checkout definido.
- Política de personalizados aprovada.

---

## Fase 1 — Arquitetura e setup

### Objetivo

Preparar base técnica para desenvolvimento seguro e escalável.

### Entregáveis

- Repositório.
- Next.js + TypeScript.
- Tailwind.
- Prisma.
- PostgreSQL.
- CI/CD.
- Staging.
- Produção inicial.
- Estrutura de pastas.
- Padrão de variáveis de ambiente.

### Critérios de aceite

- Aplicação roda localmente.
- Deploy de staging funciona.
- Banco conecta.
- Migrações rodam.
- Lint e typecheck passam no CI.

---

## Fase 2 — Design system e componentes base

### Objetivo

Transformar os HTMLs enviados em componentes reutilizáveis.

### Componentes

1. Button.
2. Badge.
3. FilterTag.
4. Input.
5. Select.
6. TextArea.
7. ProductCard.
8. Price.
9. Logo.
10. Header.
11. Footer.
12. Drawer.
13. Modal.
14. EmptyState.
15. LoadingSkeleton.
16. Alert.

### Critérios de aceite

- Todos os componentes têm estados mobile, hover, active, disabled e focus.
- Botões seguem as variantes definidas.
- Inputs seguem estados de validação.
- Cards seguem layout definido.
- Badges e tags seguem status e categorias previstos.

---

## Fase 3 — Catálogo e páginas públicas

### Objetivo

Implementar home, catálogo, busca, categorias e PDP.

### Entregáveis

- Home.
- Página de produtos.
- Página de categoria.
- Página de busca.
- Página de produto.
- Produtos relacionados.
- FAQ curto.
- Páginas institucionais.

### Critérios de aceite

- Usuário encontra produtos por categoria, busca e filtros.
- PDP permite selecionar variações e preencher personalização.
- Páginas têm metadata SEO.
- Mobile validado.

---

## Fase 4 — Carrinho e checkout

### Objetivo

Permitir que o usuário compre.

### Entregáveis

- Carrinho lateral.
- Persistência de carrinho.
- Checkout.
- Validação de dados.
- Cálculo de frete.
- Cupom, se incluído no MVP.
- Criação de pedido.

### Critérios de aceite

- Produto personalizável preserva dados no carrinho e pedido.
- Frete calcula por CEP.
- Checkout bloqueia dados inválidos.
- Pedido é criado corretamente.

---

## Fase 5 — Pagamento, frete e e-mails

### Objetivo

Integrar serviços críticos para operação real.

### Entregáveis

- Gateway de pagamento.
- Provedor de frete.
- Webhooks.
- E-mails transacionais.
- Status de pagamento.
- Status de envio.

### Critérios de aceite

- Pix gera QR code e copia-e-cola.
- Cartão aprovado atualiza pedido.
- Pagamento recusado mostra erro.
- Webhook assinado é validado.
- E-mail de pedido é enviado.

---

## Fase 6 — Admin e operação

### Objetivo

Permitir que a equipe opere produtos e pedidos.

### Entregáveis

- Login admin.
- CRUD de produtos.
- CRUD de categorias.
- Lista de pedidos.
- Detalhe do pedido.
- Atualização de status.
- Visualização de personalização.
- Configurações básicas.

### Critérios de aceite

- Admin consegue cadastrar produto completo.
- Admin visualiza personalização por item.
- Admin atualiza status de produção.
- Cliente recebe e-mail quando aplicável.

---

## Fase 7 — QA, segurança, SEO e homologação

### Objetivo

Validar que a loja está pronta para produção.

### Entregáveis

- Testes E2E.
- Testes manuais.
- Testes de acessibilidade.
- Testes de performance.
- Teste de pagamento sandbox.
- Teste de webhook.
- SEO técnico.
- Políticas legais.
- Analytics.

### Critérios de aceite

- Compra completa validada em staging.
- Erros críticos corrigidos.
- Sitemap publicado.
- Eventos de e-commerce validados.
- Páginas legais no rodapé.

---

## Fase 8 — Go-live

### Objetivo

Publicar a loja com segurança.

### Entregáveis

- Domínio apontado.
- SSL ativo.
- Pagamento em produção.
- Frete em produção.
- E-mails reais.
- Analytics ativo.
- Monitoramento ativo.
- Backup configurado.
- Compra real de teste.

### Critérios de aceite

- Pedido real de baixo valor concluído.
- E-mail recebido.
- Pedido aparece no admin.
- Pagamento confirmado.
- Métrica de compra aparece no GA4.
- Rollback documentado.

---

# 9. Backlog pronto para agentes de IA

## 9.1 Product e requisitos

| ID | Task | Agent | Dependencies | Acceptance criteria | Estimate |
|---|---|---|---|---|---|
| PRD-001 | Consolidar escopo MVP | Product | Brief, arquivos enviados | Documento define telas, fluxos, integrações e exclusões do MVP | M |
| PRD-002 | Resolver nome e identidade final | Product/Brand | Aprovação do cliente | Nome final aplicado em domínio, SEO, logo, e-mails e políticas | S |
| PRD-003 | Definir regras de personalização | Product/Ops | Lista de produtos | Cada produto personalizável tem campos, obrigatoriedade e limites definidos | M |
| PRD-004 | Definir regras de frete e produção | Product/Ops | Provedor de frete | Prazo de produção e entrega aparecem separados no checkout | M |
| PRD-005 | Definir matriz de status de pedido | Product/Ops | Fluxo operacional | Status cobrem pagamento, produção, envio, cancelamento e reembolso | S |

---

## 9.2 UX/UI

| ID | Task | Agent | Dependencies | Acceptance criteria | Estimate |
|---|---|---|---|---|---|
| UX-001 | Consolidar tokens de design | UX/UI | Paleta oficial | Tokens de cor, tipo, spacing, radius e shadow documentados | M |
| UX-002 | Criar wireframes das telas MVP | UX/UI | PRD-001 | Home, listagem, PDP, carrinho, checkout e admin cobertos | L |
| UX-003 | Converter botões em componentes | UX/UI/Frontend | buttons.html | Variantes primary, blue, outline, ghost, rose, disabled e tamanhos implementados | M |
| UX-004 | Converter badges e tags | UX/UI/Frontend | badges.html | Status e filtros aparecem conforme design e sem emoji decorativo | S |
| UX-005 | Converter cards de produto | UX/UI/Frontend | cards.html | Card tem imagem, badge, favorito, nome, preço e hover responsivo | M |
| UX-006 | Converter inputs e validações visuais | UX/UI/Frontend | inputs.html | Campos têm default, focus, ok, error e disabled | M |
| UX-007 | Criar protótipo navegável | UX/UI | UX-002 a UX-006 | Fluxo de compra navegável de home a pedido confirmado | L |

---

## 9.3 Frontend

| ID | Task | Agent | Dependencies | Acceptance criteria | Estimate |
|---|---|---|---|---|---|
| FE-001 | Inicializar Next.js com TypeScript | Frontend | Repo | App roda local, lint passa, rotas básicas funcionam | S |
| FE-002 | Configurar Tailwind e tokens | Frontend | UX-001 | Tokens importados e usados em componentes | M |
| FE-003 | Implementar layout base | Frontend | FE-001 | Header, footer, container e responsividade base prontos | M |
| FE-004 | Implementar home | Frontend | UX-007, API produtos | Home exibe hero, categorias, vitrines e CTAs | L |
| FE-005 | Implementar catálogo | Frontend | API produtos | Grid, filtros, ordenação, loading, vazio e erro funcionam | L |
| FE-006 | Implementar busca | Frontend | API busca | Busca por termo retorna produtos e mantém query na URL | M |
| FE-007 | Implementar PDP | Frontend | API produto | Galeria, variações, personalização, frete e CTAs funcionam | XL |
| FE-008 | Implementar carrinho lateral | Frontend | Cart API | Adicionar, remover, alterar quantidade e persistir itens | L |
| FE-009 | Implementar checkout | Frontend | Order API, payment API, shipping API | Checkout valida dados, seleciona frete e inicia pagamento | XL |
| FE-010 | Implementar pedido confirmado | Frontend | Order API | Página exibe número, status, resumo e próximos passos | M |
| FE-011 | Implementar páginas legais | Frontend/Content | Conteúdo legal | Políticas publicadas e linkadas no footer | M |
| FE-012 | Implementar acessibilidade de drawers/modais | Frontend | FE-008 | Foco preso, ESC fecha, aria-labels aplicados | M |

---

## 9.4 Backend

| ID | Task | Agent | Dependencies | Acceptance criteria | Estimate |
|---|---|---|---|---|---|
| BE-001 | Configurar Prisma e PostgreSQL | Backend | Banco contratado | Migrações criam schema inicial sem erro | M |
| BE-002 | Criar modelos de produto | Backend | Modelo de dados | Product, Category, Variant, Image e PersonalizationField persistem | L |
| BE-003 | Criar API de catálogo | Backend | BE-002 | Endpoints listam produtos, categorias, filtros e detalhes | L |
| BE-004 | Criar API de carrinho | Backend | BE-002 | Carrinho suporta adicionar, atualizar, remover e recuperar sessão | L |
| BE-005 | Criar API de pedidos | Backend | BE-004 | Pedido salva cliente, itens, endereço, totais e personalização | XL |
| BE-006 | Criar cálculo de totais | Backend | Coupon, shipping | Subtotal, desconto, frete e total calculados server-side | M |
| BE-007 | Criar API de cupons | Backend | Modelo Coupon | Cupom valida vigência, uso, mínimo e tipo de desconto | M |
| BE-008 | Criar status de pedidos | Backend | BE-005 | Status atualiza histórico e dispara eventos | M |
| BE-009 | Criar APIs do admin | Backend | Auth admin | CRUD de produtos, categorias e pedidos com permissão | XL |
| BE-010 | Criar auditoria mínima | Backend | Admin | Mudanças críticas registram usuário, ação e timestamp | M |

---

## 9.5 Integrações

| ID | Task | Agent | Dependencies | Acceptance criteria | Estimate |
|---|---|---|---|---|---|
| INT-001 | Integrar pagamento Pix | Backend | Conta gateway | Pix gera QR code, copia-e-cola e pedido pendente | L |
| INT-002 | Integrar pagamento cartão | Backend | Conta gateway | Cartão aprovado/recusado atualiza pedido corretamente | XL |
| INT-003 | Implementar webhook de pagamento | Backend/Security | INT-001/002 | Webhook valida assinatura e atualiza status idempotente | L |
| INT-004 | Integrar cálculo de frete | Backend | Melhor Envio/Frenet | CEP retorna opções, preço e prazo | L |
| INT-005 | Integrar e-mail transacional | Backend | Resend/SendGrid | E-mail de pedido recebido e aprovado enviado | M |
| INT-006 | Integrar WhatsApp | Frontend/Ops | Número oficial | CTA abre conversa com mensagem pré-preenchida | S |
| INT-007 | Integrar GA4/GTM | Analytics | Conta Google | Eventos view_item, add_to_cart, begin_checkout e purchase disparam | M |
| INT-008 | Integrar Sentry | DevOps | Conta Sentry | Erros frontend/backend aparecem com ambiente e release | S |

---

## 9.6 DevOps

| ID | Task | Agent | Dependencies | Acceptance criteria | Estimate |
|---|---|---|---|---|---|
| DEV-001 | Criar repositório e padrões | DevOps | Acesso Git | Branches, PR template e README configurados | S |
| DEV-002 | Configurar CI | DevOps | FE-001 | Lint, typecheck e testes rodam em PR | M |
| DEV-003 | Configurar staging | DevOps | Hosting | Branch staging publica ambiente homologável | M |
| DEV-004 | Configurar produção | DevOps | Domínio, hosting | Deploy produção com variáveis e SSL | M |
| DEV-005 | Configurar backups | DevOps | Banco | Backup automático e restore testado | M |
| DEV-006 | Criar rollback | DevOps | Hosting | Runbook permite voltar release anterior | M |
| DEV-007 | Configurar secrets | DevOps/Security | Integrações | Segredos fora do código e separados por ambiente | S |

---

## 9.7 QA

| ID | Task | Agent | Dependencies | Acceptance criteria | Estimate |
|---|---|---|---|---|---|
| QA-001 | Criar plano de testes | QA | Escopo MVP | Casos cobrem home, catálogo, PDP, carrinho, checkout e admin | M |
| QA-002 | Criar testes E2E de compra | QA/Frontend | Checkout pronto | Teste adiciona produto, personaliza, calcula frete e paga sandbox | L |
| QA-003 | Testar responsividade | QA | UI pronta | Telas aprovadas em mobile, tablet e desktop | M |
| QA-004 | Testar acessibilidade | QA | UI pronta | Navegação por teclado e foco visível em fluxos críticos | M |
| QA-005 | Testar webhooks | QA/Backend | Pagamento | Eventos duplicados não duplicam pedido nem status | M |
| QA-006 | Testar erros | QA | APIs prontas | Erros de pagamento, frete, CEP e cupom exibem mensagens claras | M |
| QA-007 | Testar performance | QA/DevOps | Staging | Home, catálogo e PDP passam metas de performance | M |

---

## 9.8 SEO e conteúdo

| ID | Task | Agent | Dependencies | Acceptance criteria | Estimate |
|---|---|---|---|---|---|
| SEO-001 | Criar mapa de URLs | SEO | Escopo | Home, categorias, produtos, institucionais e políticas definidos | S |
| SEO-002 | Criar metadata | SEO/Content | Conteúdo | Titles e descriptions únicos por página | M |
| SEO-003 | Implementar schema Product | Frontend/SEO | PDP | Product schema válido no teste de rich results | M |
| SEO-004 | Implementar sitemap e robots | Frontend/SEO | Rotas prontas | Sitemap lista páginas indexáveis e robots não bloqueia produção | S |
| SEO-005 | Redigir conteúdo institucional | Content | Tom de voz | Sobre, contato, FAQ e políticas seguem pt-BR e voz da marca | L |
| SEO-006 | Revisar microcopy | Content/UX | UI pronta | CTAs, erros, sucessos e estados vazios seguem guia | M |

---

## 9.9 Legal/compliance

| ID | Task | Agent | Dependencies | Acceptance criteria | Estimate |
|---|---|---|---|---|---|
| LEG-001 | Redigir política de privacidade | Legal | Dados coletados | Política cobre dados, cookies, pagamento, contato e LGPD | M |
| LEG-002 | Redigir termos de uso | Legal | Escopo loja | Termos publicados e linkados no footer | M |
| LEG-003 | Redigir trocas e devoluções | Legal/Ops | Regra personalizados | Política diferencia produto padrão e personalizado | M |
| LEG-004 | Redigir política de entrega | Legal/Ops | Frete | Prazos de produção e transporte explicados | S |
| LEG-005 | Validar consentimento de cookies | Legal/Frontend | Analytics | Banner ou política implementada conforme necessidade | M |

---

## 9.10 Operações

| ID | Task | Agent | Dependencies | Acceptance criteria | Estimate |
|---|---|---|---|---|---|
| OPS-001 | Criar processo de cadastro de produto | Ops | Admin | Checklist define foto, preço, SKU, descrição, peso e dimensões | M |
| OPS-002 | Criar processo de pedido personalizado | Ops | Admin | Equipe sabe localizar personalização e status de produção | M |
| OPS-003 | Criar processo de envio | Ops | Frete | Pedido produzido gera etiqueta/rastreio ou instrução manual | M |
| OPS-004 | Criar macros de atendimento | Ops/Content | FAQ | Respostas para prazo, personalização, troca e rastreio prontas | S |
| OPS-005 | Treinar operação | Ops | MVP pronto | Equipe cadastra produto e processa pedido teste sem suporte técnico | M |

---

# 10. Serviços necessários e custos aproximados

Valores aproximados em BRL. Não são cotações.

| Serviço | Exemplos de fornecedores | Etapa de contratação | Finalidade | Custo inicial aprox. | Custo mensal aprox. | Obrigatório para MVP? |
|---|---|---|---|---:|---:|---|
| Domínio | Registro.br, GoDaddy, Cloudflare | Discovery | Endereço público do site | R$ 40–R$ 150/ano | R$ 0–R$ 15 | Sim |
| DNS/CDN | Cloudflare | Setup | DNS, SSL, cache e proteção | R$ 0–R$ 500 | R$ 0–R$ 300 | Sim |
| Hosting frontend | Vercel, Netlify, Cloudflare Pages | Desenvolvimento | Publicar o Next.js | R$ 0–R$ 500 | R$ 0–R$ 1.500 | Sim |
| Backend/API | Vercel, Render, Railway, Fly.io | Desenvolvimento | APIs, webhooks e jobs | R$ 0–R$ 1.000 | R$ 50–R$ 1.500 | Sim |
| Banco PostgreSQL | Supabase, Neon, Railway, RDS | Desenvolvimento | Dados de produtos, pedidos e clientes | R$ 0–R$ 1.000 | R$ 0–R$ 1.500 | Sim |
| Storage de imagens | Cloudflare R2, S3, Supabase Storage | Desenvolvimento | Imagens de produtos e assets | R$ 0–R$ 500 | R$ 0–R$ 500 | Sim |
| Pagamentos | Mercado Pago, Pagar.me, Asaas | Desenvolvimento | Pix, cartão e boleto | R$ 0–R$ 2.000 | Taxas por transação | Sim |
| Frete | Melhor Envio, Frenet, Kangu | Desenvolvimento | Cotação, prazo, etiqueta e rastreio | R$ 0–R$ 1.000 | Plano/uso | Sim |
| E-mail transacional | Resend, SendGrid, Amazon SES | Desenvolvimento | Confirmação e status de pedido | R$ 0–R$ 500 | R$ 0–R$ 500 | Sim |
| Analytics | GA4 | Lançamento | Métricas e conversões | R$ 0–R$ 500 | R$ 0 | Sim |
| Tag manager | Google Tag Manager | Lançamento | Gerenciar pixels | R$ 0–R$ 500 | R$ 0 | Sim |
| Meta Pixel | Meta | Lançamento | Campanhas e remarketing | R$ 0 | R$ 0 | Não |
| Search Console | Google | Lançamento | Indexação e SEO | R$ 0 | R$ 0 | Sim |
| Error tracking | Sentry | Homologação | Monitorar erros | R$ 0–R$ 500 | R$ 0–R$ 800 | Sim |
| Uptime monitor | Better Stack, UptimeRobot | Homologação | Alertar indisponibilidade | R$ 0–R$ 500 | R$ 0–R$ 500 | Recomendado |
| E-mail marketing | Brevo, Mailchimp, RD Station | Pós-lançamento | Newsletters e carrinho abandonado | R$ 0–R$ 2.000 | R$ 0–R$ 1.500 | Não |
| CRM/suporte | HubSpot, Crisp, Zendesk | Lançamento/Pós | Atendimento e tickets | R$ 0–R$ 2.000 | R$ 0–R$ 1.500 | Não |
| Ferramenta de design | Figma | Discovery/design | Protótipos e handoff | R$ 0–R$ 500 | R$ 0–R$ 300/usuário | Recomendado |
| QA cross-browser | BrowserStack, QA freelancer | Homologação | Testes em navegadores/dispositivos | R$ 500–R$ 5.000 | R$ 0–R$ 1.000 | Recomendado |
| Jurídico/LGPD | Advogado, consultor LGPD | Discovery/Lançamento | Políticas, termos e privacidade | R$ 800–R$ 8.000 | R$ 0–R$ 2.000 | Sim |
| Contabilidade/fiscal | Contador, Bling, Tiny | Lançamento | CNPJ, notas, operação fiscal | R$ 300–R$ 3.000 | R$ 200–R$ 1.500 | Depende da operação |
| ERP leve | Bling, Tiny | v1 | Emissão fiscal, estoque, pedidos | R$ 0–R$ 1.500 | R$ 50–R$ 500 | Não |
| Busca avançada | Algolia, Typesense, Meilisearch | v1 | Busca rápida e filtros refinados | R$ 0–R$ 1.000 | R$ 0–R$ 1.500 | Não |

## 10.1 Orçamento mínimo para lançamento

Considerando ferramentas com planos gratuitos ou iniciais:

- **Custo inicial mínimo:** R$ 1.500–R$ 6.000, sem contar mão de obra de desenvolvimento.
- **Mensal mínimo:** R$ 100–R$ 800 + taxas de pagamento/frete.

## 10.2 Orçamento recomendado para v1

Com operação mais segura, QA, jurídico, monitoramento e ferramentas pagas:

- **Custo inicial recomendado:** R$ 8.000–R$ 30.000, sem contar equipe fixa.
- **Mensal recomendado:** R$ 800–R$ 5.000 + taxas de pagamento/frete.

## 10.3 Principais drivers de custo

1. Checkout customizado.
2. Integração com gateway.
3. Integração de frete.
4. Admin completo.
5. Preview de personalização.
6. ERP/fiscal.
7. QA e segurança.
8. Volume de imagens e tráfego.

---

# 11. Dependências e riscos

| Risco | Impacto | Mitigação | Dono |
|---|---|---|---|
| Nome da marca indefinido | Retrabalho em SEO, logo, domínio e e-mails | Fechar decisão na Fase 0 | Product |
| Paleta inconsistente | Interface incoerente | Consolidar tokens antes do frontend | UX |
| Checkout customizado subestimado | Atraso e bugs críticos | Usar provedor maduro e testar sandbox cedo | Backend |
| Webhook duplicado | Pedido ou status duplicado | Idempotência por providerPaymentId | Backend |
| Frete com pesos/dimensões errados | Preço incorreto de entrega | Campos obrigatórios e teste de cotação | Ops |
| Produto personalizado sem dados | Pedido impossível de produzir | Validação obrigatória no PDP, carrinho e backend | Product/Backend |
| Políticas legais incompletas | Risco jurídico e suporte | Validar políticas antes do go-live | Legal |
| Imagens pesadas | Baixa performance | Otimização, CDN e tamanhos responsivos | Frontend |
| Falta de operação administrativa | Vendas sem capacidade de execução | Admin mínimo e treinamento antes do lançamento | Ops |
| Erros pós-lançamento invisíveis | Perda de pedidos | Sentry, logs e monitoramento | DevOps |

---

# 12. Estratégia de testes

## 12.1 Testes unitários

Cobrir:

1. Cálculo de subtotal.
2. Cálculo de desconto.
3. Validação de cupom.
4. Validação de personalização.
5. Validação de CPF.
6. Validação de e-mail.
7. Validação de CEP.
8. Conversão de status de pagamento.
9. Idempotência de webhook.

## 12.2 Testes de integração

Cobrir:

1. Criar pedido.
2. Adicionar item ao carrinho.
3. Atualizar quantidade.
4. Calcular frete.
5. Gerar pagamento Pix.
6. Processar webhook.
7. Enviar e-mail.

## 12.3 Testes E2E

Fluxo principal:

1. Usuário acessa home.
2. Entra no catálogo.
3. Filtra por categoria.
4. Abre produto.
5. Preenche personalização.
6. Adiciona ao carrinho.
7. Calcula frete.
8. Vai ao checkout.
9. Preenche dados.
10. Paga com Pix sandbox.
11. Visualiza pedido confirmado.
12. Admin vê pedido.

## 12.4 Testes manuais

1. Mobile pequeno.
2. Mobile grande.
3. Tablet.
4. Desktop.
5. Menu mobile.
6. Drawer do carrinho.
7. PDP com produto normal.
8. PDP com produto personalizável.
9. PDP com produto esgotado.
10. Checkout com erro de cartão.
11. Checkout com CEP inválido.
12. Cupom inválido.
13. Contato.
14. FAQ.
15. Links do rodapé.

## 12.5 Testes de acessibilidade

1. Navegação por teclado.
2. Foco visível.
3. Labels.
4. Contraste.
5. Alt text.
6. Drawer acessível.
7. Mensagens de erro vinculadas.

## 12.6 Testes de performance

1. Lighthouse.
2. Core Web Vitals.
3. Peso das imagens.
4. Tempo da PDP.
5. Tempo do catálogo.
6. Scripts de terceiros.
7. Cache.

## 12.7 Testes de segurança

1. Variáveis de ambiente.
2. Rate limit.
3. Validação server-side.
4. Webhook assinado.
5. Admin protegido.
6. Tentativa de alterar preço no client.
7. Logs sem dados sensíveis.

---

# 13. Checklist de go-live

## 13.1 Infraestrutura

- [ ] Domínio configurado.
- [ ] DNS apontado.
- [ ] SSL ativo.
- [ ] Produção publicada.
- [ ] Staging preservado.
- [ ] Variáveis de produção configuradas.
- [ ] Banco de produção criado.
- [ ] Backups ativos.
- [ ] Rollback documentado.

## 13.2 Pagamento

- [ ] Gateway em produção.
- [ ] Pix testado.
- [ ] Cartão testado.
- [ ] Webhook em produção.
- [ ] Pagamento recusado testado.
- [ ] Pedido não duplica em webhook repetido.

## 13.3 Frete

- [ ] Conta de frete ativa.
- [ ] CEP válido retorna cotação.
- [ ] CEP inválido retorna erro claro.
- [ ] Peso e dimensões cadastrados.
- [ ] Frete grátis configurado, se houver.
- [ ] Prazo de produção separado do prazo de entrega.

## 13.4 E-mails

- [ ] Domínio de envio validado.
- [ ] SPF/DKIM/DMARC configurados.
- [ ] Pedido recebido enviado.
- [ ] Pagamento aprovado enviado.
- [ ] Pedido enviado preparado.
- [ ] Remetente correto.

## 13.5 SEO

- [ ] Titles.
- [ ] Descriptions.
- [ ] Sitemap.
- [ ] Robots.txt.
- [ ] Canonical.
- [ ] Open Graph.
- [ ] Schema Product.
- [ ] Schema Organization.
- [ ] Search Console.

## 13.6 Analytics

- [ ] GA4 instalado.
- [ ] GTM instalado.
- [ ] Meta Pixel, se aplicável.
- [ ] Evento `view_item`.
- [ ] Evento `add_to_cart`.
- [ ] Evento `begin_checkout`.
- [ ] Evento `purchase`.
- [ ] Conversão validada.

## 13.7 Conteúdo e legal

- [ ] Sobre.
- [ ] FAQ.
- [ ] Contato.
- [ ] Política de privacidade.
- [ ] Termos de uso.
- [ ] Trocas e devoluções.
- [ ] Política de entrega.
- [ ] Política de personalizados.
- [ ] CNPJ/dados comerciais, se aplicável.

## 13.8 Operação

- [ ] Produtos cadastrados.
- [ ] Categorias cadastradas.
- [ ] SKUs revisados.
- [ ] Preços revisados.
- [ ] Fotos revisadas.
- [ ] Peso/dimensões revisados.
- [ ] Admin treinado.
- [ ] Pedido teste processado.
- [ ] Atendimento preparado.

---

# 14. Operação pós-lançamento

## 14.1 Rotina diária

1. Verificar pedidos.
2. Verificar pagamentos pendentes.
3. Verificar erros no Sentry.
4. Verificar mensagens de contato/WhatsApp.
5. Atualizar status de produção.
6. Atualizar status de envio.
7. Conferir estoque ou capacidade produtiva.

## 14.2 Rotina semanal

1. Revisar conversão.
2. Revisar produtos mais vistos.
3. Revisar abandono de carrinho.
4. Revisar buscas sem resultado.
5. Revisar páginas com erro 404.
6. Revisar performance.
7. Ajustar descrições e fotos.
8. Publicar novos produtos.

## 14.3 Rotina mensal

1. Analisar faturamento.
2. Analisar margem por produto.
3. Revisar custo de frete.
4. Revisar campanhas.
5. Revisar SEO.
6. Revisar políticas se houver mudança operacional.
7. Planejar melhorias da v1.

---

# 15. Ordem recomendada de execução

1. Confirmar nome final da marca.
2. Confirmar paleta visual oficial.
3. Confirmar domínio.
4. Escolher gateway de pagamento.
5. Escolher provedor de frete.
6. Definir política de produtos personalizados.
7. Criar PRD final do MVP.
8. Criar arquitetura técnica.
9. Inicializar repositório.
10. Configurar Next.js, TypeScript, Tailwind e Prisma.
11. Configurar banco.
12. Criar tokens de design.
13. Implementar componentes base.
14. Implementar home.
15. Implementar catálogo.
16. Implementar PDP.
17. Implementar carrinho.
18. Implementar checkout.
19. Integrar pagamento.
20. Integrar frete.
21. Integrar e-mails.
22. Criar admin.
23. Criar páginas legais.
24. Configurar SEO.
25. Configurar analytics.
26. Configurar monitoramento.
27. Executar QA.
28. Fazer compra teste em sandbox.
29. Fazer compra real de baixo valor.
30. Publicar em produção.

---

# 16. Decisão arquitetural recomendada

Para este projeto, a recomendação final é:

- **Next.js + TypeScript + Tailwind** no frontend.
- **PostgreSQL + Prisma** no banco.
- **API própria no Next.js** para MVP.
- **Mercado Pago ou Pagar.me** para pagamento.
- **Melhor Envio ou Frenet** para frete.
- **Resend** para e-mail transacional.
- **Vercel** para deploy.
- **Sentry** para erros.
- **GA4 + GTM + Search Console** para analytics e SEO.
- **Admin próprio simples** no MVP.

Essa combinação equilibra velocidade, controle, custo e capacidade de evolução.

Para uma versão mais rápida e com menor desenvolvimento customizado, a alternativa seria usar uma plataforma pronta como Nuvemshop, Shopify ou WooCommerce. Porém, isso reduziria o controle sobre personalização, fluxo de produção e experiência customizada.
