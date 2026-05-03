import 'server-only'

import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'

/**
 * Catálogo de templates de e-mail.
 *
 * Cada slug aqui é a "chave" que `lib/email.ts` usa pra renderizar um e-mail.
 * O `defaultSubject` e `defaultHtml` são o fallback hardcoded — usados
 * automaticamente quando:
 *   - o admin nunca customizou o template, OU
 *   - o template foi marcado `isActive = false`, OU
 *   - o banco está indisponível.
 *
 * `variables` documenta o vocabulário que o renderizador aceita; o admin
 * vê isso na UI pra saber o que pode usar.
 */
export type EmailTemplateSlug =
  | 'order_confirmation'
  | 'payment_approved'
  | 'order_in_production'
  | 'order_shipped'
  | 'order_delivered'
  | 'order_refunded'
  | 'password_reset'
  | 'access_code'
  | 'restock_alert'

export interface EmailTemplateDefinition {
  slug: EmailTemplateSlug
  label: string
  description: string
  variables: { name: string; description: string; example: string }[]
  defaultSubject: string
  defaultHtml: string
  defaultText?: string
}

/**
 * Render `{{var}}` placeholders. Mantém intencionalmente simples — sem
 * helpers/condicionais à la Handlebars. Se o admin precisar de algo mais,
 * o e-mail técnico (transacional crítico) continua funcionando via o
 * fallback hardcoded.
 *
 * Valores são HTML-escapados por padrão; pra inserir HTML cru (ex.: tabela
 * de itens já renderizada), use `rawVariables`.
 */
export function renderTemplate(
  template: { subject: string; htmlBody: string; textBody?: string | null },
  variables: Record<string, string | number>,
  rawVariables: Record<string, string> = {},
): { subject: string; html: string; text: string | null } {
  const escape = (value: string | number) =>
    String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')

  const apply = (input: string) =>
    input
      // Raw vars primeiro pra não escapar HTML legítimo (ex.: linhas de itens).
      .replace(/\{\{\s*raw\.([\w-]+)\s*\}\}/g, (_match, name) => rawVariables[name] ?? '')
      .replace(/\{\{\s*([\w-]+)\s*\}\}/g, (_match, name) => {
        const value = variables[name]
        return value === undefined || value === null ? '' : escape(value)
      })

  return {
    subject: apply(template.subject),
    html: apply(template.htmlBody),
    text: template.textBody ? apply(template.textBody) : null,
  }
}

/**
 * Lê do banco e cai pro default se não há override ativo.
 * Nunca lança — se Prisma der erro, devolve o default.
 */
export async function getResolvedTemplate(slug: EmailTemplateSlug): Promise<{
  subject: string
  htmlBody: string
  textBody: string | null
  source: 'override' | 'default'
}> {
  const def = TEMPLATE_CATALOG[slug]
  if (!def) {
    throw new Error(`Unknown email template slug: ${slug}`)
  }

  const fallback = {
    subject: def.defaultSubject,
    htmlBody: def.defaultHtml,
    textBody: def.defaultText ?? null,
    source: 'default' as const,
  }

  if (!hasDatabase || !prisma?.emailTemplate) return fallback

  try {
    const override = await prisma.emailTemplate.findUnique({ where: { slug } })
    if (!override || !override.isActive) return fallback
    return {
      subject: override.subject,
      htmlBody: override.htmlBody,
      textBody: override.textBody,
      source: 'override',
    }
  } catch (error) {
    console.error('[email-templates] failed to read override, using default:', error)
    return fallback
  }
}

// ============================================================================
// Catálogo
// ============================================================================
//
// Os defaults aqui DUPLICAM o HTML que estava em lib/email.ts. Isso é
// intencional — o ponto do CRUD é dar ao admin um lugar pra editar copy sem
// mexer em código, mas garantir que se o banco morrer / template for excluído,
// o e-mail técnico continua saindo idêntico ao que sai hoje.
//
// Variáveis disponíveis:
//   - {{varName}} — interpolação HTML-escapada (segura)
//   - {{raw.varName}} — interpolação crua (use com cuidado, só pra HTML interno
//     já gerado pelo código, ex.: linhas da tabela de itens)

const ITEMS_VAR = {
  name: 'itemsHtml',
  description: 'HTML cru das linhas da tabela de itens (use {{raw.itemsHtml}})',
  example: '<tr><td>Produto X</td><td>R$ 99,00</td></tr>',
}

export const TEMPLATE_CATALOG: Record<EmailTemplateSlug, EmailTemplateDefinition> = {
  order_confirmation: {
    slug: 'order_confirmation',
    label: 'Confirmação de pedido',
    description: 'Enviado logo após o cliente finalizar o checkout.',
    variables: [
      { name: 'orderNumber', description: 'Número do pedido', example: 'BED-000123' },
      { name: 'customerName', description: 'Nome do cliente', example: 'Maria Silva' },
      { name: 'total', description: 'Total formatado em BRL', example: '199,90' },
      ITEMS_VAR,
    ],
    defaultSubject: 'Pedido {{orderNumber}} confirmado - BED Design',
    defaultHtml: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: 'DM Sans', Arial, sans-serif; background-color: #F5F2EE; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 32px;">
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="color: #C8552A; font-size: 28px; margin: 0;">BED Design</h1>
    </div>
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="width: 60px; height: 60px; background-color: #1D7A72; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
      </div>
      <h2 style="color: #1C1917; font-size: 24px; margin: 0 0 8px 0;">Pedido confirmado!</h2>
      <p style="color: #78716C; margin: 0;">Obrigado pela sua compra, {{customerName}}!</p>
    </div>
    <div style="background-color: #F5F2EE; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
      <p style="color: #78716C; font-size: 14px; margin: 0 0 4px 0;">Número do pedido</p>
      <p style="color: #1C1917; font-size: 20px; font-weight: 600; margin: 0; font-family: monospace;">{{orderNumber}}</p>
    </div>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <thead>
        <tr>
          <th style="text-align: left; padding: 12px; border-bottom: 2px solid #E8E2DA; color: #78716C; font-size: 14px;">Produto</th>
          <th style="text-align: right; padding: 12px; border-bottom: 2px solid #E8E2DA; color: #78716C; font-size: 14px;">Valor</th>
        </tr>
      </thead>
      <tbody>
        {{raw.itemsHtml}}
        <tr>
          <td style="padding: 12px; font-weight: 600;">Total</td>
          <td style="padding: 12px; text-align: right; font-weight: 600; font-size: 18px;">R$ {{total}}</td>
        </tr>
      </tbody>
    </table>
    <p style="color: #78716C; font-size: 14px; line-height: 1.6;">
      Seu pedido foi recebido e em breve entraremos em produção. Você receberá atualizações por e-mail sobre o status do seu pedido.
    </p>
    <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #E8E2DA; text-align: center;">
      <p style="color: #78716C; font-size: 14px; margin: 0;">Precisa de ajuda? Entre em contato pelo WhatsApp ou responde este e-mail.</p>
    </div>
  </div>
</body>
</html>`,
  },

  payment_approved: {
    slug: 'payment_approved',
    label: 'Pagamento aprovado',
    description: 'Enviado quando o webhook do MP confirma pagamento.',
    variables: [
      { name: 'orderNumber', description: 'Número do pedido', example: 'BED-000123' },
      { name: 'customerName', description: 'Nome do cliente', example: 'Maria Silva' },
    ],
    defaultSubject: 'Pagamento aprovado - Pedido {{orderNumber}} - BED Design',
    defaultHtml: `<h2>Pagamento aprovado!</h2>
<p>Olá {{customerName}}, o pagamento do seu pedido {{orderNumber}} foi aprovado!</p>
<p>Em breve seu pedido entrará em produção.</p>`,
  },

  order_in_production: {
    slug: 'order_in_production',
    label: 'Pedido entrou em produção',
    description: 'Disparado quando admin marca o pedido como em produção.',
    variables: [
      { name: 'orderNumber', description: 'Número do pedido', example: 'BED-000123' },
      { name: 'customerFirstName', description: 'Primeiro nome do cliente', example: 'Maria' },
    ],
    defaultSubject: 'Pedido {{orderNumber}} entrou em produção - BED Design',
    defaultHtml: `<div style="font-family: Arial, sans-serif; color: #1D2235; max-width: 560px; margin: 0 auto;">
  <h2 style="color: #1D2235;">Olá, {{customerFirstName}}!</h2>
  <p>Boa notícia: seu pedido <strong>{{orderNumber}}</strong> entrou em produção.</p>
  <p>Cada peça é impressa sob demanda. Assim que estiver pronta para envio, enviaremos um novo aviso com o código de rastreio.</p>
  <p style="color: #6B7494; font-size: 13px;">Qualquer dúvida, é só responder este e-mail.</p>
</div>`,
  },

  order_shipped: {
    slug: 'order_shipped',
    label: 'Pedido enviado',
    description: 'Disparado quando o pedido vai para os Correios (manual ou via webhook ME).',
    variables: [
      { name: 'orderNumber', description: 'Número do pedido', example: 'BED-000123' },
      { name: 'trackingCode', description: 'Código de rastreio', example: 'BR123456789BR' },
    ],
    defaultSubject: 'Pedido {{orderNumber}} enviado! - BED Design',
    defaultHtml: `<h2>Seu pedido foi enviado!</h2>
<p>O pedido {{orderNumber}} foi postado e está a caminho.</p>
<p>Código de rastreamento: <strong>{{trackingCode}}</strong></p>
<p>Acompanhe a entrega pelo site dos Correios.</p>`,
  },

  order_delivered: {
    slug: 'order_delivered',
    label: 'Pedido entregue',
    description: 'Disparado quando o webhook ME registra entrega.',
    variables: [
      { name: 'orderNumber', description: 'Número do pedido', example: 'BED-000123' },
    ],
    defaultSubject: 'Pedido {{orderNumber}} entregue! - BED Design',
    defaultHtml: `<div style="font-family: Arial, sans-serif; color: #1D2235; max-width: 560px; margin: 0 auto;">
  <h2 style="color: #1D7A72;">Seu pedido foi entregue!</h2>
  <p>O pedido <strong>{{orderNumber}}</strong> foi marcado como entregue.</p>
  <p>Esperamos que você ame o que pediu! Se tiver qualquer feedback ou problema, é só responder este e-mail.</p>
</div>`,
  },

  order_refunded: {
    slug: 'order_refunded',
    label: 'Estorno do pedido',
    description: 'Disparado quando admin estorna pelo MP.',
    variables: [
      { name: 'orderNumber', description: 'Número do pedido', example: 'BED-000123' },
      { name: 'customerFirstName', description: 'Primeiro nome do cliente', example: 'Maria' },
      { name: 'amount', description: 'Valor formatado em BRL', example: '99,90' },
    ],
    defaultSubject: 'Estorno do pedido {{orderNumber}} - BED Design',
    defaultHtml: `<div style="font-family: Arial, sans-serif; color: #1D2235; max-width: 560px; margin: 0 auto;">
  <h2 style="color: #8B5CF6;">Estorno em processamento</h2>
  <p>Olá, {{customerFirstName}},</p>
  <p>O reembolso do pedido <strong>{{orderNumber}}</strong> no valor de <strong>R$ {{amount}}</strong> foi solicitado ao Mercado Pago.</p>
  <p>O valor deve voltar para a sua forma de pagamento original em até 7 dias úteis (cartão) ou imediatamente (Pix), conforme as regras do banco emissor.</p>
  <p style="color: #6B7494; font-size: 13px;">Qualquer dúvida, é só responder este e-mail.</p>
</div>`,
  },

  password_reset: {
    slug: 'password_reset',
    label: 'Redefinição de senha (admin)',
    description: 'Link de redefinição de senha — admins.',
    variables: [
      { name: 'customerFirstName', description: 'Primeiro nome (vazio se desconhecido)', example: 'Edu' },
      { name: 'resetUrl', description: 'URL completa do link', example: 'https://beddesigns.com.br/login/redefinir-senha?token=...' },
    ],
    defaultSubject: 'Redefinição de senha - B&D Artes & Impressões',
    defaultHtml: `<div style="font-family: Arial, sans-serif; color: #1D2235; max-width: 560px; margin: 0 auto;">
  <h2 style="color: #1D2235;">Olá, {{customerFirstName}}!</h2>
  <p>Recebemos uma solicitação para redefinir a senha da sua conta de administrador.</p>
  <p>Clique no botão abaixo para escolher uma nova senha. O link expira em 1 hora.</p>
  <p style="margin: 32px 0;">
    <a href="{{resetUrl}}" style="display: inline-block; padding: 14px 28px; background: #1D2235; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Redefinir senha</a>
  </p>
  <p style="color: #6B7494; font-size: 14px;">Se o botão não funcionar, copie e cole este link no navegador:</p>
  <p style="color: #6B7494; font-size: 13px; word-break: break-all;">{{resetUrl}}</p>
  <hr style="border: none; border-top: 1px solid #E3E9F4; margin: 24px 0;" />
  <p style="color: #6B7494; font-size: 13px;">Se você não solicitou esta redefinição, ignore este e-mail. Sua senha continua a mesma.</p>
</div>`,
  },

  access_code: {
    slug: 'access_code',
    label: 'Código de acesso (OTP)',
    description: 'Código de 6 dígitos para login OTP.',
    variables: [
      { name: 'code', description: 'Código de 6 dígitos', example: '123456' },
    ],
    defaultSubject: 'Seu código de acesso - B&D Artes & Impressões',
    defaultHtml: `<div style="font-family: Arial, sans-serif; color: #1D2235;">
  <h2>Seu código de acesso</h2>
  <p>Use o código abaixo para entrar na loja. Ele expira em 10 minutos.</p>
  <p style="font-size: 28px; letter-spacing: 6px; font-weight: 700;">{{code}}</p>
  <p>Se você não solicitou este acesso, ignore este e-mail.</p>
</div>`,
  },

  restock_alert: {
    slug: 'restock_alert',
    label: 'Produto voltou ao estoque',
    description: 'Disparado quando produto que cliente pediu para avisar volta a ter estoque.',
    variables: [
      { name: 'productName', description: 'Nome do produto', example: 'Chaveiro Personalizado' },
      { name: 'productUrl', description: 'URL do produto', example: 'https://beddesigns.com.br/produtos/chaveiro' },
    ],
    defaultSubject: '{{productName}} voltou! - B&D Artes & Impressões',
    defaultHtml: `<div style="font-family: Arial, sans-serif; color: #1D2235; max-width: 560px; margin: 0 auto;">
  <h2 style="color: #1D7A72;">Boa notícia!</h2>
  <p>O produto <strong>{{productName}}</strong> está disponível novamente.</p>
  <p style="margin: 24px 0;">
    <a href="{{productUrl}}" style="display: inline-block; padding: 12px 22px; background: #1D2235; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Ver produto</a>
  </p>
  <p style="color: #6B7494; font-size: 13px;">Você recebeu este e-mail porque pediu para ser avisado quando este produto voltasse ao estoque.</p>
</div>`,
  },
}

export function getCatalog(): EmailTemplateDefinition[] {
  return Object.values(TEMPLATE_CATALOG)
}
