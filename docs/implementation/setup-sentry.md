# Setup Sentry — BED Design

A integração com Sentry já está implementada no código. Sem DSN configurado, o app funciona normalmente; ao definir as variáveis de ambiente, os erros começam a ser reportados automaticamente.

## Passos para o stakeholder

1. **Criar conta gratuita** em [sentry.io](https://sentry.io). O plano free cobre o volume atual com folga.

2. **Criar projeto** dentro da conta:
   - Tipo: **Next.js**
   - Nome sugerido: **BED Design** (ou `bed-design-prod`)
   - Time/org: padrão da conta

3. **Copiar o DSN**. Após criar, o Sentry mostra algo como:
   ```
   https://abc123def456@o000000.ingest.sentry.io/1234567
   ```
   Copie a URL inteira.

4. **Configurar no Railway** (serviço web do BED Design):
   - Adicione duas variáveis com **o mesmo valor** (o DSN copiado):
     - `SENTRY_DSN` — usada pelo runtime server
     - `NEXT_PUBLIC_SENTRY_DSN` — usada pelo runtime do navegador
   - Variáveis opcionais (não obrigatórias para começar):
     - `SENTRY_RELEASE` / `NEXT_PUBLIC_SENTRY_RELEASE` — útil para correlacionar erros a uma versão específica (ex.: o SHA do commit)
     - `SENTRY_AUTH_TOKEN` — necessário só se quiser upload de sourcemaps; deixa em branco no MVP

5. **Redeploy** o serviço para que as variáveis sejam aplicadas.

6. **Validar** acessando, logado como admin:
   - `GET /api/admin/sentry-test?type=error` — força um erro intencional
   - `GET /api/admin/sentry-test?type=message` — envia uma mensagem informativa

   Em até ~30 segundos, o evento deve aparecer em **Issues** dentro do projeto Sentry. Se aparecer, está funcionando.

## O que será capturado

- Erros não tratados em rotas server-side e client-side (auto)
- Erros explicitamente reportados via `captureException` / `captureMessage` em `lib/observability.ts`. Hoje, os pontos críticos cobertos são:
  - Webhook do Mercado Pago (`app/api/webhooks/mercadopago`)
  - Chamadas à API do Mercado Pago (`lib/mercadopago.ts`)
  - Criação de pedido (`app/api/orders`)
  - Tarefas de produção (`app/api/producao/[id]`)

`lib/database.ts` ainda usa `console.error` legado — está fora do escopo deste PR e será migrado depois (são dezenas de chamadas).

## Privacidade — PII scrub (best-effort)

Antes de enviar eventos ao Sentry, `lib/sentry-scrub.ts` substitui por `[REDACTED]` os seguintes padrões em messages, breadcrumbs, exceptions e URLs:
- E-mails
- CPF (11 dígitos, com ou sem máscara)
- Telefones BR (10–11 dígitos, com ou sem máscara)
- CEP (8 dígitos, com ou sem máscara)

**É melhor que nada, mas não é à prova de bala.** Trate o projeto Sentry como confidencial: restrinja acesso a admins. Se passar a transmitir dados mais sensíveis, revise o scrubber e considere mecanismos adicionais (Sentry Data Scrubbing nativo, server-side relay).

## Não habilitado intencionalmente

- **Session Replay** — risco de privacidade alto + custo. Desligado (`replaysSessionSampleRate: 0`).
- **Profiling** — overhead de CPU. Desligado.
- **Tracing**: amostragem em 10% (`tracesSampleRate: 0.1`) para limitar consumo de quota.

## Follow-ups

- Migrar `console.error` legado em `lib/database.ts` para `captureException` (PR separado).
- Configurar `SENTRY_AUTH_TOKEN` + upload de sourcemaps quando for útil ler stack traces minificados de erros do browser.
- Definir alertas em Sentry → Alerts (ex.: quando volume de erros do webhook MP excede X em Y minutos).
