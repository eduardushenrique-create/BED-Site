## Setup Cloudflare R2 — BED Design

A integração com Cloudflare R2 já está implementada no código (storage adapter em `lib/storage/`). Sem credenciais R2 configuradas, o sistema continua salvando imagens como base64 inline no banco — comportamento atual, **zero regressão**. Ao definir as 5 variáveis de ambiente, os uploads novos passam a ir para o R2 e a UI segue funcionando normalmente.

R2 escolhido pelo ADR-001 por ter **egress gratuito** (vs. ~$0.09/GB no S3 puro), 10 GB de storage no free tier, e API S3-compatible — ou seja, dá pra trocar de provider sem reescrever código se necessário.

### Passos para o stakeholder

1. **Criar conta gratuita** em [dash.cloudflare.com](https://dash.cloudflare.com). Não precisa cartão para o R2 free tier.

2. **Habilitar R2** na barra lateral (em "R2 Object Storage"). Se for a primeira vez, a Cloudflare pede aceite dos termos.

3. **Criar bucket**: clique em "Create bucket".
   - Nome sugerido: `bed-design-images` (ou `bed-images`, `bed-design-prod-images` — qualquer nome global único na sua conta).
   - Location: deixa "Automatic" (ou escolhe `EEUR`/`ENAM` se quiser pinar mais perto do Brasil).
   - **NÃO marque** "Provide bucket-level encryption" e nem "Object Lock" — não precisa para imagens públicas.

4. **Pegar o Account ID**: na home do R2 (ou em "Manage R2 API Tokens"), copie o **Account ID** que aparece no canto superior direito da página da conta. Esse será o valor de `R2_ACCOUNT_ID`.

5. **Criar API Token** com escopo limitado:
   - R2 → "Manage R2 API Tokens" → "Create API Token"
   - **Token name**: `bed-design-app`
   - **Permissions**: "Object Read & Write"
   - **Specify bucket(s)**: marque "Apply to specific buckets only" e selecione o bucket criado no passo 3 — *importante para limitar o blast radius*
   - **TTL**: deixa "Forever" (ou define expiração se preferir rotacionar)
   - Clique em "Create API Token"
   - Copie **Access Key ID** → `R2_ACCESS_KEY_ID`
   - Copie **Secret Access Key** → `R2_SECRET_ACCESS_KEY` (só aparece uma vez!)

6. **Liberar acesso público** ao bucket:
   - Bucket → aba "Settings" → seção **"Public access"** → "R2.dev subdomain" → clique em "Allow Access"
   - A Cloudflare gera uma URL pública do tipo `https://pub-XXXXXXXXXXXXXXXXX.r2.dev` — esse é o valor de `R2_PUBLIC_URL`
   - **Limite**: o `r2.dev` tem rate limit (não é pra produção pesada). Para tráfego real, use a opção 6b abaixo.

   **6b. (Opcional, recomendado em produção)** Custom Domain via Cloudflare DNS:
   - Bucket → "Settings" → "Custom Domains" → "Connect Domain"
   - Sugestão: `imagens.seu-dominio.com.br` ou `cdn.seu-dominio.com.br`
   - Cloudflare cria automaticamente o CNAME se o DNS do domínio estiver na própria Cloudflare (mais simples) — caso contrário, copie o destino do CNAME e crie no seu provedor de DNS
   - Aguarde alguns minutos para o status virar "Active"
   - Use a URL final como `R2_PUBLIC_URL=https://imagens.seu-dominio.com.br` (sem barra no final)

7. **Configurar no Railway** (serviço web do BED Design): adicione as 5 variáveis de ambiente:
   ```
   R2_ACCOUNT_ID=...
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_BUCKET_NAME=bed-design-images
   R2_PUBLIC_URL=https://pub-XXXXX.r2.dev   # ou seu custom domain
   ```

8. **Redeploy** o serviço para aplicar as variáveis.

9. **Validar uploads novos** entrando no admin:
   - `/admin/produtos` → editar um produto → trocar a imagem principal
   - Inspecionar o `<img>` no DevTools → o `src` deve apontar para `https://...r2.dev/products/<hash>.jpg` (não mais `data:image/...`)
   - Mesmo teste em `/admin/banners`

10. **Migrar imagens antigas** (que ainda estão como base64 no banco):
    - Endpoint: `POST /api/admin/migrate-images` (precisa estar logado como admin)
    - Body opcional: `{ "batchSize": 20 }` (default 20, máx 50 por chamada)
    - Resposta: `{ migrated, remaining, breakdown: { productImages, banners }, errors }`
    - Repita até `remaining === 0`. Cada chamada migra um lote — fazer em batch evita time-out e segura uso de memória.
    - Comando rápido (no DevTools ou curl logado):
      ```js
      // Repete até esvaziar — cole no console do navegador estando logado como admin:
      async function migrate() {
        let r = await fetch('/api/admin/migrate-images', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).then(r => r.json())
        console.log(r)
        if (r.remaining > 0) setTimeout(migrate, 1500)
      }
      migrate()
      ```
    - Para ver o status sem migrar: `GET /api/admin/migrate-images`.

### Como o fallback funciona

`lib/storage/index.ts:getStorage()` lê as 5 envs no primeiro acesso:
- **Todas presentes** → instancia `R2Storage` (sobe para R2 e devolve URL pública)
- **Faltando qualquer uma** → instancia `InlineStorage` (devolve a própria data URL como antes)

Em ambos os casos a API e o schema são idênticos. O campo novo `storageKey` em `ProductImage`/`Banner` é populado só quando R2 está ativo, permitindo limpar o objeto remoto na hora de deletar a imagem.

### Custo esperado

Para o volume atual da BED Design (catálogo de dezenas a centenas de SKUs com 1-8 imagens cada, ~200KB pós-compressão):
- **Storage**: 100MB ≈ ~0.0015 USD/mês (free até 10GB)
- **Class A operations** (puts/deletes): grátis até 1M/mês
- **Egress**: $0 (R2 não cobra saída — diferencial)

Cenário pessimista (10GB + 100k uploads + 10M views/mês): ainda dentro do free tier para storage; classes A já cobertas. **Esperado: $0/mês**.

### Riscos & mitigações

- **Bucket público**: qualquer um com a URL acessa o objeto (esperado para imagens de catálogo). Não armazenar nada sensível neste bucket. Para uploads internos no futuro, criar bucket separado privado.
- **Vazamento de credenciais R2**: o token tem escopo só no bucket de imagens — pior caso é defacement. Rotacionar pelo dashboard se houver suspeita.
- **r2.dev rate limit**: ok pra desenvolvimento e baixo tráfego. Para produção mover para custom domain (passo 6b) — ganha cache CDN gratuito da Cloudflare.
- **Custom Domain mal-configurado**: se o CNAME apontar errado, imagens novas viram 404. Sempre validar com uma imagem de teste antes de migrar o lote antigo.
- **Imagem inline antiga não migrada**: enquanto não roda `/api/admin/migrate-images`, registros velhos continuam servindo data URL — funciona, só não tem o ganho de performance/payload menor.

### Estado atual no código

- `lib/storage/types.ts`, `r2.ts`, `inline.ts`, `index.ts`, `data-url.ts` — adapter pattern + helpers
- `lib/database.ts` — `addProductImage`, `removeProductImage`, `createProduct`, `updateProduct`, `createBanner`, `updateBanner`, `deleteBanner` integrados com o adapter
- `app/api/produtos/[id]/imagens/route.ts` — POST faz upload via adapter quando recebe data URL
- `app/api/admin/migrate-images/route.ts` — endpoint de migração em batch (admin only, 503 se R2 não configurado)
- `prisma/schema.prisma` + `prisma/migrations/20260504000000_storage_keys/migration.sql` — coluna `storageKey TEXT?`
- `next.config.ts` — `images.remotePatterns` lê `R2_PUBLIC_URL` automaticamente
