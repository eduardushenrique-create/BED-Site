# ADR-001 — Migração de imagens base64 para object storage

## Status
Proposto — 2026-05-01

## Contexto

Hoje as imagens de produtos e banners são gravadas como **data URL base64** dentro do Postgres:

- `ProductImage.url` (TEXT) — até 8 imagens por produto, ~1.6 MB cada após compressão client-side (PR #9)
- `Banner.imageUrl` (TEXT)
- Componente `<SafeImage>` usa `<img>` puro (sem `next/image`)
- Hospedagem: Railway (Postgres + Next na mesma plataforma)

**Sintomas atuais e dívida que isso gera:**

1. **Postgres inchado** — base64 infla ~33% sobre o binário; uma linha de produto com 8 imagens pode passar de **17 MB**. Backups, dumps, replicação e queries de listagem ficam pesados.
2. **Latência no payload** — toda resposta `/api/produtos` carrega o data URL completo, mesmo em listagens. Não há lazy loading nem WebP automático.
3. **Sem CDN / sem cache de borda** — Postgres serve cada byte a cada request.
4. **`next/image` inviável** — `next/image` recusa data URLs longos para otimização.
5. **Custo de Postgres no Railway escala mal com binário** — storage do volume de DB é ~$2.59/GB-mês, ~170× mais caro que object storage.

A janela é boa para resolver agora, antes de o catálogo crescer e a migração ficar mais cara.

## Decisão

**Adotar Cloudflare R2 como object storage primário**, com adapter `lib/storage/index.ts` que abstrai o provider para permitir troca futura sem refactor de chamadas.

Fallback recomendado caso o stakeholder prefira menor curva de setup: **UploadThing** (DX nativa Next.js, free tier 2 GB).

## Alternativas avaliadas

### Opção A — Cloudinary

| Aspecto | Detalhe |
|---|---|
| Free tier | 25 GB storage + 25 créditos/mês (1 crédito = 1 GB egress ou 1.000 transformações) |
| Custo MVP (até 5 GB, baixo tráfego) | $0 |
| Custo em escala (50 GB storage, 100 GB egress, ~50k transformações) | Free tier estoura. Plus: **$89/mês (anual) ou $99/mês (mensal)** |
| Setup | Conta + cloud name + API key + upload preset |
| Lock-in | Médio (URLs `res.cloudinary.com/<cloud>/...` específicas, mas migráveis) |
| CDN global | Sim |
| Transformações on-the-fly | Sim — resize, crop, format auto, WebP/AVIF via URL params |
| Tempo de implementação | ~4–6h |

**Prós**
- Transformações automáticas (`f_auto,q_auto,w_800`) eliminam necessidade de gerar variações.
- CDN robusto e maduro.
- DAM e busca embutidos (irrelevante hoje, mas opcional).

**Contras**
- Salto de preço brutal: $0 → $99/mês ao passar do free tier.
- Sistema de "créditos" opaco para stakeholder não-técnico.
- Egress conta como crédito — picos de tráfego viral podem queimar quota rápido.

### Opção B — Supabase Storage

| Aspecto | Detalhe |
|---|---|
| Free tier | 1 GB storage + 5 GB egress (cached) |
| Custo MVP (até 1 GB) | $0 |
| Custo em escala (50 GB storage, 100 GB egress) | Pro $25/mês + (~$0/storage até 100 GB incluso) + egress $0 até 250 GB → **~$25/mês** |
| Setup | Conta + bucket + service-role key + RLS policies |
| Lock-in | Médio (URLs `<project>.supabase.co/storage/v1/...`) |
| CDN | Sim (Smart CDN só no Pro; Basic CDN no free) |
| Transformações on-the-fly | Sim, mas só no Pro: 100 imagens-origem incluso, depois $5/1000 |
| Tempo de implementação | ~3–5h |

**Prós**
- Faz sentido se o projeto futuramente migrar para Supabase Auth/Postgres (já há `lib/supabase.ts` legado).
- $25 cobre storage + auth + DB no mesmo provider — economia consolidada se houver migração maior.

**Contras**
- Free tier de 1 GB é apertado: 1.6 MB × ~625 imagens.
- Pagar $25/mês só por storage hoje, sem usar Auth/DB do Supabase, é desperdício.
- Image transformations bloqueadas no free.

### Opção C — Railway Volumes

| Aspecto | Detalhe |
|---|---|
| Free tier | 0.5 GB (Free) / 5 GB (Hobby, $5/mês) / 50 GB (Pro, $20/mês) |
| Custo MVP | Incluso no plano atual se couber em 5 GB; ~$2.59/GB-mês acima |
| Custo em escala (50 GB) | ~$130/mês só de volume |
| Setup | 1h — montar volume na service do Next |
| Lock-in | Baixo (são arquivos em filesystem) |
| CDN global | **Não** — servido pelo container Railway, single region |
| Transformações on-the-fly | Não (precisaria `sharp` server-side) |
| Tempo de implementação | ~2–3h |

**Prós**
- Mesmíssimo provider, zero contas novas.
- Adapter mais simples (escreve em `/data/uploads`).

**Contras**
- **$2.59/GB-mês é ~170× mais caro que R2** ($0.015/GB).
- Sem CDN — toda imagem percorre o data center do Railway até o cliente.
- Volume amarrado a uma única service: se o container restartar/morre, latência de cold-start afeta entrega de imagem.
- Não escala horizontalmente.

### Opção D — UploadThing

| Aspecto | Detalhe |
|---|---|
| Free tier | 2 GB storage, uploads/downloads ilimitados |
| Custo MVP (até 2 GB) | $0 |
| Custo em escala (100 GB) | $10/mês (plano 100 GB); $25/mês para 250 GB; $0.08/GB acima |
| Setup | Conta + token + SDK Next.js (uploadthing/react) |
| Lock-in | Médio (URLs `utfs.io/...`, mas é wrapper de S3) |
| CDN global | Sim (CloudFront por baixo) |
| Transformações on-the-fly | Não nativo (precisa Next.js Image Optimizer ou sharp) |
| Tempo de implementação | ~2–3h |

**Prós**
- DX excelente para Next.js: hook `useUploadThing`, validação de mime/size declarativa.
- Preço previsível e linear; sem sistema de "créditos".
- 2 GB free é confortável para o MVP atual.

**Contras**
- Sem transformações — depende de `next/image` para resize/WebP.
- Wrapper proprietário sobre S3: se sair do UploadThing, é refactor de upload, não só de URL.

### Opção E — Cloudflare R2

| Aspecto | Detalhe |
|---|---|
| Free tier | 10 GB storage + 1M Class A ops + 10M Class B ops por mês |
| Custo MVP (até 10 GB) | $0 |
| Custo em escala (50 GB storage, ~5M reads/mês) | Storage: 40 GB × $0.015 = **$0.60**. Reads (Class B): grátis até 10M. Total: **<$1/mês** |
| Setup | Conta CF + bucket + API token (S3-compatible) + custom domain opcional |
| Lock-in | Baixo — API S3-compatible, troca para R2/MinIO/B2 com swap de endpoint |
| CDN global | Sim, via domínio público R2 (`r2.dev`) ou Cloudflare custom domain |
| Egress | **Zero** (diferencial central) |
| Transformações on-the-fly | Não nativo. Cloudflare Images é addon ($5/mês por 100k imgs) ou usar `next/image` |
| Tempo de implementação | ~3–5h (incluindo custom domain + cache rules) |

**Prós**
- **Mais barato em qualquer cenário não-trivial.** Free tier 10 GB cobre bem mais que MVP.
- Zero egress fee — protege contra surpresa de conta em pico viral.
- API S3 padrão = zero lock-in real.
- Mesmo ecossistema da Cloudflare (DNS, WAF, Workers) se o projeto crescer.

**Contras**
- Sem transformações nativas grátis (Cloudinary ganha aqui se transformations forem central).
- Requer um pouco mais de setup que UploadThing (custom domain + CORS).
- Stakeholder não-técnico pode achar dashboard CF intimidador.

## Comparação resumida

| Critério | Cloudinary | Supabase | Railway Vol | UploadThing | **R2** |
|---|---|---|---|---|---|
| Custo até 5 GB | $0 | $0 (1 GB cap) | incluso Hobby | $0 | **$0** |
| Custo até 50 GB / 100 GB egress | ~$99 | $25 | ~$130 | $10 | **<$1** |
| Egress fee | Conta como crédito | Cobrado acima de incluso | Incluso (mas sem CDN) | Incluso | **Zero** |
| CDN global | Sim | Sim (Pro) | Não | Sim | Sim |
| Resize on-the-fly | Sim | Sim (Pro) | Não | Não | Não (addon) |
| Setup time | 2–4h | 3–5h | 1–3h | 2–3h | 3–5h |
| Lock-in | Médio | Médio | Baixo | Médio | **Baixo** |
| Previsibilidade de custo | Baixa (créditos) | Média | Alta | **Alta** | **Alta** |

## Recomendação

**Top 1 — Cloudflare R2.** Para um e-commerce pequeno-médio com prioridade explícita em **mínimo gasto recorrente**, R2 é dominante:

- Free tier de 10 GB cobre meses ou anos do BED Design no estado atual.
- Zero egress = stakeholder nunca recebe surpresa de conta após uma campanha que viralizou.
- API S3 = se R2 desagradar, troca para Backblaze B2 ou AWS S3 muda 1 env var.
- Combina com `next/image` para resize/WebP, eliminando a necessidade de transformações server-side do provider.

**Fallback — UploadThing.** Se o stakeholder quiser **simplicidade absoluta de setup** e estiver disposto a pagar $10/mês quando ultrapassar 2 GB, UploadThing entrega DX superior (hooks Next.js prontos) sem ter que mexer em CORS ou custom domain. Trade-off: depois de 250 GB, custo cresce linearmente; já R2 continua trivial.

**Por que NÃO Cloudinary:** salto de $0 para $99/mês é desproporcional ao perfil do projeto. Faria sentido se transformações on-the-fly fossem requisito central — não são.

**Por que NÃO Railway Volumes:** sem CDN é regressão visível em UX de catálogo, e o custo por GB é absurdo comparado a object storage.

**Por que NÃO Supabase Storage hoje:** só vale se houver decisão paralela de migrar Auth/DB para Supabase. Caso contrário, $25/mês para o que R2 faz por <$1.

## Impacto na implementação

Assumindo R2:

- **Schema:** zero mudança. `ProductImage.url` continua `TEXT`, passa a guardar URL pública (`https://images.beddesign.com.br/products/<id>.webp`) em vez de data URL.
- **Código novo:**
  - `lib/storage/index.ts` — adapter interface `{ uploadImage(buffer, contentType): Promise<{ url, key }>; deleteImage(key): Promise<void> }`.
  - `lib/storage/r2.ts` — implementação via `@aws-sdk/client-s3` apontando para endpoint R2.
  - `lib/storage/uploadthing.ts` — implementação alternativa (opcional, para validar abstração).
  - Refatorar `lib/image-upload.ts` para uploadar server-side em vez de retornar base64.
  - Refatorar handlers `/api/produtos/[id]/imagens` e admin de banners para `multipart/form-data` (ou base64 → upload no backend).
  - Atualizar `next.config.ts` `images.remotePatterns` para o domínio R2/custom.
  - Migrar `<SafeImage>` para `next/image` (ganha lazy loading + WebP automático).
- **Migração de dados existentes:**
  - Script Node single-shot em `scripts/migrate-base64-to-r2.ts`: lê `ProductImage` e `Banner` onde `url LIKE 'data:%'`, decodifica, faz upload, atualiza coluna.
  - Idempotente — checar prefixo antes de processar.
  - Manter coluna backup `url_legacy` por 1 sprint para rollback.
- **Variáveis de ambiente novas:**
  - `STORAGE_PROVIDER=r2`
  - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`

## Estimativa de esforço

- Implementação adapter + refactor uploads: **1–2 dias dev**
- Migração dados + script backfill: **+0.5 dia** (~1h por 1.000 imagens)
- QA + ajustes `<SafeImage>` → `next/image`: **2–4h**
- Total: **~2–3 dias**

## Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| R2 muda preço / impõe egress fee | Baixa | Médio | Adapter S3 facilita troca para B2/S3 |
| Migração quebra URLs antigas | Baixa | Alto | Coluna `url_legacy` + script idempotente; rollback trivial |
| Custo explode em pico viral | Muito baixa | Baixo | R2 sem egress fee; pior caso é Class B ops, ~$0.36/M reads |
| Setup CORS / custom domain confunde | Média | Baixo | Documentar passo-a-passo no README; fallback em `pub-<id>.r2.dev` |
| `next/image` quebra layouts atuais | Média | Médio | PR separado para troca, com QA visual |

## Decisões pendentes para o stakeholder

1. **Provider:** R2 (recomendado) ou UploadThing (mais simples)?
2. **Migração de imagens antigas:** backfill total agora ou lazy migration (só novos uploads passam pelo storage; antigos continuam base64 até serem reuploadadas)?
3. **`next/image`:** mesmo PR ou PR separado? Recomendo separado para isolar regressões visuais.
4. **Custom domain:** usar `images.beddesign.com.br` (requer DNS na Cloudflare) ou começar com `pub-<id>.r2.dev`?

## Referências

- [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudinary Pricing](https://cloudinary.com/pricing)
- [Cloudinary Credits FAQ](https://cloudinary.com/documentation/developer_onboarding_faq_credits)
- [Supabase Pricing](https://supabase.com/pricing)
- [UploadThing Pricing](https://uploadthing.com/pricing)
- [Railway Volumes Reference](https://docs.railway.com/reference/volumes)
- [Railway Pricing](https://railway.com/pricing)
