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
  | 'low_stock_alert'
  | 'order_component_shortage'

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
// Helpers de construção de HTML
// ============================================================================

const STORE_URL = 'https://beddesigns.com.br'
const LOGO_URL = 'https://beddesigns.com.br/logo.svg'

// Zero-width + nbsp characters prevent email clients from bleeding the preheader
// into the body preview.
const PREVIEW_PADDING = '‌ ‌ ‌ ‌ ‌ ‌ ‌ ‌ ‌ ‌ ‌ ‌ ‌ ‌ ‌ '

const LOGO_HTML = `<a href="${STORE_URL}" style="text-decoration:none;display:inline-block;"><img src="${LOGO_URL}" alt="B&D Artes &amp; Impressões" width="160" height="30" style="display:block;border:0;" /></a>`

function btn(label: string, href: string, bg = '#1D2235', fg = '#ffffff'): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px auto;"><tr><td align="center" bgcolor="${bg}" style="background-color:${bg};border-radius:8px;"><a href="${href}" style="display:inline-block;padding:14px 32px;font-family:Arial,sans-serif;font-size:15px;font-weight:600;color:${fg};text-decoration:none;">${label}</a></td></tr></table>`
}

function hr(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;"><tr><td style="border-top:1px solid #D8DCE8;font-size:0;line-height:0;">&nbsp;</td></tr></table>`
}

function p(text: string, size = '16px', color = '#6B7494'): string {
  return `<p style="color:${color};font-family:Arial,sans-serif;font-size:${size};line-height:1.7;margin:0 0 16px;">${text}</p>`
}

function infoBox(content: string, bg: string, border: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0;"><tr><td bgcolor="${bg}" style="background-color:${bg};border:1px solid ${border};border-radius:10px;padding:20px 24px;">${content}</td></tr></table>`
}

function buildEmail(params: {
  preheader: string
  accentColor: string
  accentBg: string
  icon: string
  heading: string
  content: string
  footerNote?: string
}): string {
  const { preheader, accentColor, accentBg, icon, heading, content, footerNote } = params
  const footer = footerNote ?? 'D&uacute;vidas? Responda este e-mail ou fale conosco pelo WhatsApp.'

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
</head>
<body style="margin:0;padding:0;background-color:#F0F5FB;">
<div style="display:none;font-size:1px;max-height:0;overflow:hidden;mso-hide:all;">${preheader}${PREVIEW_PADDING}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F0F5FB;min-width:320px;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(29,34,53,0.08);">

<tr><td bgcolor="${accentColor}" style="background-color:${accentColor};height:8px;font-size:0;line-height:0;">&nbsp;</td></tr>

<tr><td align="center" style="padding:28px 48px 24px;border-bottom:1px solid #D8DCE8;">${LOGO_HTML}</td></tr>

<tr><td align="center" style="padding:36px 48px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
<tr><td align="center" valign="middle" width="72" height="72" bgcolor="${accentBg}" style="width:72px;height:72px;background-color:${accentBg};border-radius:36px;font-size:32px;text-align:center;line-height:72px;">${icon}</td></tr>
</table>
</td></tr>

<tr><td align="center" style="padding:20px 48px 4px;">
<h1 style="color:${accentColor};font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;margin:0;line-height:1.3;text-align:center;">${heading}</h1>
</td></tr>

<tr><td style="padding:20px 48px 40px;">${content}</td></tr>

<tr><td bgcolor="#F0F5FB" style="background-color:#F0F5FB;padding:28px 48px;text-align:center;border-top:1px solid #D8DCE8;">
<p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:13px;line-height:1.6;"><a href="${STORE_URL}" style="color:#1D2235;text-decoration:none;font-weight:600;">B&amp;D Artes &amp; Impressões</a></p>
<p style="margin:0;color:#6B7494;font-family:Arial,sans-serif;font-size:12px;line-height:1.6;">${footer}</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
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
  // --------------------------------------------------------------------------
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
    defaultSubject: 'Pedido {{orderNumber}} confirmado - B&D Artes & Impressões',
    defaultHtml: buildEmail({
      preheader: 'Seu pedido foi recebido! Obrigado pela compra.',
      accentColor: '#1D7A72',
      accentBg: '#E0F4F0',
      icon: '&#10003;',
      heading: 'Pedido confirmado!',
      content: `
${p('Obrigado pela sua compra, <strong style="color:#1D2235;">{{customerName}}</strong>! Seu pedido foi recebido com sucesso e já está em nossa fila.')}

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:4px 0 24px;">
<tr><td align="center" bgcolor="#F0F9F7" style="background-color:#F0F9F7;border:1px solid #A7D9D3;border-radius:10px;padding:20px;">
  <p style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#1D7A72;margin:0 0 6px;font-weight:600;">N&uacute;mero do pedido</p>
  <p style="font-family:'Courier New',Courier,monospace;font-size:22px;font-weight:700;color:#1D2235;margin:0;letter-spacing:1px;">{{orderNumber}}</p>
</td></tr>
</table>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:0 0 20px;">
  <thead>
    <tr>
      <th align="left" style="font-family:Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#6B7494;padding:0 12px 10px 0;border-bottom:2px solid #D8DCE8;">Produto</th>
      <th align="right" style="font-family:Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#6B7494;padding:0 0 10px;border-bottom:2px solid #D8DCE8;">Valor</th>
    </tr>
  </thead>
  <tbody>
    {{raw.itemsHtml}}
    <tr><td colspan="2" style="border-top:2px solid #D8DCE8;padding:0;font-size:0;line-height:0;"></td></tr>
    <tr>
      <td style="font-family:Arial,sans-serif;font-size:16px;font-weight:600;color:#1D2235;padding:12px 12px 0 0;">Total</td>
      <td align="right" style="font-family:Arial,sans-serif;font-size:20px;font-weight:700;color:#1D7A72;padding:12px 0 0;">R$&nbsp;{{total}}</td>
    </tr>
  </tbody>
</table>

${p('Em breve seu pedido entrar&aacute; em produ&ccedil;&atilde;o. Voc&ecirc; receber&aacute; atualizações por e-mail em cada etapa. Qualquer d&uacute;vida, &eacute; s&oacute; responder este e-mail.', '14px', '#6B7494')}`,
    }),
  },

  // --------------------------------------------------------------------------
  payment_approved: {
    slug: 'payment_approved',
    label: 'Pagamento aprovado',
    description: 'Enviado quando o webhook do MP confirma pagamento.',
    variables: [
      { name: 'orderNumber', description: 'Número do pedido', example: 'BED-000123' },
      { name: 'customerName', description: 'Nome do cliente', example: 'Maria Silva' },
    ],
    defaultSubject: 'Pagamento aprovado - Pedido {{orderNumber}} - B&D Artes & Impressões',
    defaultHtml: buildEmail({
      preheader: 'Pagamento confirmado! Seu pedido já vai entrar em produção.',
      accentColor: '#1D7A72',
      accentBg: '#E0F4F0',
      icon: '&#128176;',
      heading: 'Pagamento aprovado!',
      content: `
${p('&Oacute;tima not&iacute;cia, <strong style="color:#1D2235;">{{customerName}}</strong>! O pagamento do seu pedido foi confirmado.')}

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:4px 0 24px;">
<tr><td align="center" bgcolor="#F0F9F7" style="background-color:#F0F9F7;border:1px solid #A7D9D3;border-radius:10px;padding:20px;">
  <p style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#1D7A72;margin:0 0 6px;font-weight:600;">Pedido</p>
  <p style="font-family:'Courier New',Courier,monospace;font-size:22px;font-weight:700;color:#1D2235;margin:0;letter-spacing:1px;">{{orderNumber}}</p>
</td></tr>
</table>

${p('Agora seu pedido vai entrar em produ&ccedil;&atilde;o. Cada pe&ccedil;a &eacute; produzida sob demanda com muito cuidado. Assim que estiver pronta, voc&ecirc; receber&aacute; o c&oacute;digo de rastreio.')}
${p('Agradecemos a confian&ccedil;a! &#128522;', '14px', '#6B7494')}`,
    }),
  },

  // --------------------------------------------------------------------------
  order_in_production: {
    slug: 'order_in_production',
    label: 'Pedido entrou em produção',
    description: 'Disparado quando admin marca o pedido como em produção.',
    variables: [
      { name: 'orderNumber', description: 'Número do pedido', example: 'BED-000123' },
      { name: 'customerFirstName', description: 'Primeiro nome do cliente', example: 'Maria' },
    ],
    defaultSubject: 'Pedido {{orderNumber}} entrou em produção - B&D Artes & Impressões',
    defaultHtml: buildEmail({
      preheader: 'Uhu! Seu pedido acabou de entrar em produção.',
      accentColor: '#4A7AB5',
      accentBg: '#E8F0FB',
      icon: '&#9881;',
      heading: 'Em produ&ccedil;&atilde;o!',
      content: `
${p('Ol&aacute;, <strong style="color:#1D2235;">{{customerFirstName}}</strong>! Seu pedido <strong style="color:#1D2235;">{{orderNumber}}</strong> acabou de entrar em produ&ccedil;&atilde;o.')}

${infoBox(`
<p style="font-family:Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#4A7AB5;margin:0 0 14px;">Progresso do pedido</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="padding:6px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="20" style="color:#2E7D6E;font-size:16px;line-height:1;">&#10003;</td>
      <td style="font-family:Arial,sans-serif;font-size:14px;color:#2E7D6E;padding-left:8px;">Pedido recebido e pagamento confirmado</td>
    </tr></table></td>
  </tr>
  <tr>
    <td style="padding:6px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="20" bgcolor="#4A7AB5" style="background-color:#4A7AB5;border-radius:50%;width:18px;height:18px;text-align:center;line-height:18px;font-size:10px;color:#fff;font-weight:700;">&#9654;</td>
      <td style="font-family:Arial,sans-serif;font-size:14px;color:#4A7AB5;font-weight:600;padding-left:8px;">Em produ&ccedil;&atilde;o agora</td>
    </tr></table></td>
  </tr>
  <tr>
    <td style="padding:6px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="20" style="color:#A8AFCA;font-size:16px;line-height:1;">&#9679;</td>
      <td style="font-family:Arial,sans-serif;font-size:14px;color:#A8AFCA;padding-left:8px;">Enviado para os Correios</td>
    </tr></table></td>
  </tr>
  <tr>
    <td style="padding:6px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="20" style="color:#A8AFCA;font-size:16px;line-height:1;">&#9679;</td>
      <td style="font-family:Arial,sans-serif;font-size:14px;color:#A8AFCA;padding-left:8px;">Entregue</td>
    </tr></table></td>
  </tr>
</table>`, '#EEF3FB', '#BBCFEB')}

${p('Cada pe&ccedil;a &eacute; impressa sob demanda com muito cuidado. Assim que estiver pronta e postada, voc&ecirc; receber&aacute; o c&oacute;digo de rastreio por e-mail.', '14px', '#6B7494')}`,
    }),
  },

  // --------------------------------------------------------------------------
  order_shipped: {
    slug: 'order_shipped',
    label: 'Pedido enviado',
    description: 'Disparado quando o pedido vai para os Correios (manual ou via webhook ME).',
    variables: [
      { name: 'orderNumber', description: 'Número do pedido', example: 'BED-000123' },
      { name: 'trackingCode', description: 'Código de rastreio', example: 'BR123456789BR' },
    ],
    defaultSubject: 'Pedido {{orderNumber}} enviado! - B&D Artes & Impressões',
    defaultHtml: buildEmail({
      preheader: 'Seu pedido foi postado! Acompanhe pelo código de rastreio.',
      accentColor: '#4A7AB5',
      accentBg: '#E8F0FB',
      icon: '&#128230;',
      heading: 'Pedido enviado!',
      content: `
${p('Seu pedido <strong style="color:#1D2235;">{{orderNumber}}</strong> foi postado e j&aacute; est&aacute; a caminho!')}

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 20px;">
<tr><td align="center" bgcolor="#EEF3FB" style="background-color:#EEF3FB;border:1px solid #BBCFEB;border-radius:10px;padding:28px 24px;">
  <p style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#4A7AB5;margin:0 0 10px;font-weight:600;">C&oacute;digo de rastreio</p>
  <p style="font-family:'Courier New',Courier,monospace;font-size:24px;font-weight:700;color:#1D2235;margin:0 0 20px;letter-spacing:2px;">{{trackingCode}}</p>
  ${btn('Rastrear nos Correios', 'https://www.correios.com.br/rastrear-encomendas?objetos={{trackingCode}}', '#4A7AB5')}
</td></tr>
</table>

${p('Prazo de entrega: veja o c&oacute;digo de rastreio acima para a estimativa mais recente. Prazos podem variar por regi&atilde;o e per&iacute;odo.', '14px', '#6B7494')}`,
    }),
  },

  // --------------------------------------------------------------------------
  order_delivered: {
    slug: 'order_delivered',
    label: 'Pedido entregue',
    description: 'Disparado quando o webhook ME registra entrega.',
    variables: [
      { name: 'orderNumber', description: 'Número do pedido', example: 'BED-000123' },
    ],
    defaultSubject: 'Pedido {{orderNumber}} entregue! - B&D Artes & Impressões',
    defaultHtml: buildEmail({
      preheader: 'Seu pedido foi entregue! Esperamos que você ame.',
      accentColor: '#1D7A72',
      accentBg: '#E0F4F0',
      icon: '&#127873;',
      heading: 'Pedido entregue!',
      content: `
${p('O pedido <strong style="color:#1D2235;">{{orderNumber}}</strong> foi marcado como entregue. Esperamos que voc&ecirc; ame!')}

${infoBox(`
<p style="font-family:Arial,sans-serif;font-size:14px;color:#1D7A72;font-weight:600;margin:0 0 6px;">Obrigado por comprar na B&amp;D Artes &amp; Impressões &#128522;</p>
<p style="font-family:Arial,sans-serif;font-size:14px;color:#6B7494;margin:0;line-height:1.6;">
  Cada pe&ccedil;a &eacute; feita com muito carinho. Se tiver qualquer d&uacute;vida sobre o produto ou o pedido, &eacute; s&oacute; responder este e-mail.
</p>`, '#F0F9F7', '#A7D9D3')}

${p('Quer compartilhar como ficou? Marque a gente nas redes sociais! Adoramos ver as fotos dos nossos clientes. &#128247;', '14px', '#6B7494')}`,
    }),
  },

  // --------------------------------------------------------------------------
  order_refunded: {
    slug: 'order_refunded',
    label: 'Estorno do pedido',
    description: 'Disparado quando admin estorna pelo MP.',
    variables: [
      { name: 'orderNumber', description: 'Número do pedido', example: 'BED-000123' },
      { name: 'customerFirstName', description: 'Primeiro nome do cliente', example: 'Maria' },
      { name: 'amount', description: 'Valor formatado em BRL', example: '99,90' },
    ],
    defaultSubject: 'Estorno do pedido {{orderNumber}} - B&D Artes & Impressões',
    defaultHtml: buildEmail({
      preheader: 'Estorno solicitado. O valor será devolvido em breve.',
      accentColor: '#7C3AED',
      accentBg: '#EDE9FE',
      icon: '&#8617;',
      heading: 'Estorno em andamento',
      content: `
${p('Ol&aacute;, <strong style="color:#1D2235;">{{customerFirstName}}</strong>!')}
${p('O reembolso do pedido <strong style="color:#1D2235;">{{orderNumber}}</strong> no valor de <strong style="color:#7C3AED;">R$&nbsp;{{amount}}</strong> foi solicitado ao Mercado Pago e est&aacute; sendo processado.')}

${infoBox(`
<p style="font-family:Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#7C3AED;margin:0 0 14px;">Prazo para recebimento</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr><td style="font-family:Arial,sans-serif;font-size:14px;color:#6B7494;padding:5px 0;"><strong style="color:#1D2235;">Pix:</strong> at&eacute; 1 dia &uacute;til</td></tr>
  <tr><td style="font-family:Arial,sans-serif;font-size:14px;color:#6B7494;padding:5px 0;"><strong style="color:#1D2235;">Cart&atilde;o de cr&eacute;dito:</strong> at&eacute; 2 faturas (conforme banco emissor)</td></tr>
  <tr><td style="font-family:Arial,sans-serif;font-size:14px;color:#6B7494;padding:5px 0;"><strong style="color:#1D2235;">Boleto:</strong> at&eacute; 5 dias &uacute;teis</td></tr>
</table>`, '#F5F0FF', '#DDD6FE')}

${p('Qualquer d&uacute;vida sobre o estorno, responda este e-mail. Lamentamos qualquer inconveni&ecirc;ncia.', '14px', '#6B7494')}`,
    }),
  },

  // --------------------------------------------------------------------------
  password_reset: {
    slug: 'password_reset',
    label: 'Redefinição de senha (admin)',
    description: 'Link de redefinição de senha — admins.',
    variables: [
      { name: 'customerFirstName', description: 'Primeiro nome (vazio se desconhecido)', example: 'Edu' },
      { name: 'resetUrl', description: 'URL completa do link', example: 'https://beddesigns.com.br/login/redefinir-senha?token=...' },
    ],
    defaultSubject: 'Redefinição de senha - B&D Artes & Impressões',
    defaultHtml: buildEmail({
      preheader: 'Recebemos uma solicitação para redefinir sua senha de administrador.',
      accentColor: '#1D2235',
      accentBg: '#EEF1F8',
      icon: '&#128274;',
      heading: 'Redefini&ccedil;&atilde;o de senha',
      content: `
${p('Ol&aacute;, <strong style="color:#1D2235;">{{customerFirstName}}</strong>!')}
${p('Recebemos uma solicita&ccedil;&atilde;o para redefinir a senha da sua conta de administrador. Clique no bot&atilde;o abaixo para escolher uma nova senha.')}

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 24px;">
<tr><td align="center">${btn('Redefinir minha senha', '{{resetUrl}}', '#1D2235')}</td></tr>
</table>

${infoBox(`<p style="font-family:Arial,sans-serif;font-size:13px;color:#6B7494;margin:0;line-height:1.6;">&#9203;&nbsp; <strong>O link expira em 1 hora.</strong> Se n&atilde;o funcionar mais, solicite outro acesso pelo painel de login.</p>`, '#FFFBEB', '#FCD34D')}

${hr()}

${p('Se o bot&atilde;o n&atilde;o funcionar, copie e cole este link no navegador:', '13px', '#6B7494')}
<p style="font-family:'Courier New',Courier,monospace;font-size:12px;color:#4A7AB5;word-break:break-all;margin:0 0 20px;line-height:1.6;">{{resetUrl}}</p>

${p('Se voc&ecirc; n&atilde;o solicitou esta redefini&ccedil;&atilde;o, ignore este e-mail com seguran&ccedil;a. Sua senha permanece a mesma.', '13px', '#6B7494')}`,
      footerNote: 'Este e-mail foi enviado para a conta de administrador da B&amp;D Artes &amp; Impressões.',
    }),
  },

  // --------------------------------------------------------------------------
  access_code: {
    slug: 'access_code',
    label: 'Código de acesso (OTP)',
    description: 'Código de 6 dígitos para login OTP.',
    variables: [
      { name: 'code', description: 'Código de 6 dígitos', example: '123456' },
    ],
    defaultSubject: 'Seu código de acesso - B&D Artes & Impressões',
    defaultHtml: buildEmail({
      preheader: 'Seu código de acesso de 6 dígitos está aqui. Expira em 10 minutos.',
      accentColor: '#1D2235',
      accentBg: '#EEF1F8',
      icon: '&#128273;',
      heading: 'C&oacute;digo de acesso',
      content: `
${p('Use o c&oacute;digo abaixo para entrar na sua conta. Ele expira em <strong>10 minutos</strong>.')}

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 24px;">
<tr><td align="center" bgcolor="#F0F5FB" style="background-color:#F0F5FB;border:2px dashed #BBCFEB;border-radius:12px;padding:36px 24px;">
  <p style="font-family:'Courier New',Courier,monospace;font-size:48px;font-weight:700;color:#1D2235;margin:0;letter-spacing:14px;text-align:center;">{{code}}</p>
</td></tr>
</table>

${p('N&atilde;o compartilhe este c&oacute;digo com ningu&eacute;m. A B&amp;D Artes &amp; Impressões nunca solicitar&aacute; seu c&oacute;digo por telefone ou chat.', '13px', '#6B7494')}
${p('Se voc&ecirc; n&atilde;o solicitou este c&oacute;digo, ignore este e-mail. Sua conta est&aacute; segura.', '13px', '#6B7494')}`,
    }),
  },

  // --------------------------------------------------------------------------
  restock_alert: {
    slug: 'restock_alert',
    label: 'Produto voltou ao estoque',
    description: 'Disparado quando produto que cliente pediu para avisar volta a ter estoque.',
    variables: [
      { name: 'productName', description: 'Nome do produto', example: 'Chaveiro Personalizado' },
      { name: 'productUrl', description: 'URL do produto', example: 'https://beddesigns.com.br/produtos/chaveiro' },
    ],
    defaultSubject: '{{productName}} voltou! - B&D Artes & Impressões',
    defaultHtml: buildEmail({
      preheader: 'Boa notícia! O produto que você queria está disponível novamente.',
      accentColor: '#1D7A72',
      accentBg: '#E0F4F0',
      icon: '&#128276;',
      heading: 'Boa not&iacute;cia!',
      content: `
${p('O produto que voc&ecirc; pediu para ser avisado(a) est&aacute; dispon&iacute;vel novamente:')}

${infoBox(`<p style="font-family:Arial,sans-serif;font-size:18px;font-weight:700;color:#1D2235;margin:0;text-align:center;">{{productName}}</p>`, '#F0F9F7', '#A7D9D3')}

${p('N&atilde;o deixe para depois — produtos personalizados podem voltar a esgotar rapidamente!', '14px', '#44526E')}

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 20px;">
<tr><td align="center">${btn('Ver produto agora', '{{productUrl}}', '#1D7A72')}</td></tr>
</table>

${hr()}

${p('Voc&ecirc; recebeu este e-mail porque pediu para ser avisado(a) quando este produto voltasse ao estoque.', '12px', '#A8AFCA')}`,
    }),
  },

  // --------------------------------------------------------------------------
  low_stock_alert: {
    slug: 'low_stock_alert',
    label: 'Estoque baixo (componente)',
    description: 'Aviso interno disparado quando um componente atinge o limite mínimo configurado.',
    variables: [
      { name: 'componentName', description: 'Nome do componente', example: 'TAG NFC 13.56MHz' },
      { name: 'componentSku', description: 'SKU do componente', example: 'NFC-001' },
      { name: 'currentStock', description: 'Saldo atual formatado', example: '8' },
      { name: 'unit', description: 'Unidade de medida', example: 'un' },
      { name: 'threshold', description: 'Limite mínimo configurado', example: '10' },
      { name: 'restockUrl', description: 'Link pra tela do componente no admin', example: 'https://app.beddesigns.com.br/admin/componentes/abc' },
      { name: 'supplierUrl', description: 'Link de recompra (se cadastrado)', example: 'https://fornecedor.com/produto' },
    ],
    defaultSubject: '⚠️ Estoque baixo: {{componentName}} ({{currentStock}} {{unit}}) — B&D Artes & Impressões',
    defaultHtml: buildEmail({
      preheader: 'Componente abaixo do estoque mínimo. Providencie reposição.',
      accentColor: '#B45309',
      accentBg: '#FEF3C7',
      icon: '&#9888;',
      heading: 'Estoque baixo',
      content: `
${p('O componente abaixo atingiu o estoque m&iacute;nimo configurado. Providencie a reposi&ccedil;&atilde;o para evitar atrasos nos pedidos.')}

${infoBox(`
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td style="font-family:Arial,sans-serif;font-size:13px;color:#6B7494;padding:5px 12px 5px 0;width:130px;">Componente</td>
    <td style="font-family:Arial,sans-serif;font-size:14px;font-weight:600;color:#1D2235;padding:5px 0;">{{componentName}}</td>
  </tr>
  <tr>
    <td style="font-family:Arial,sans-serif;font-size:13px;color:#6B7494;padding:5px 12px 5px 0;">SKU</td>
    <td style="font-family:'Courier New',Courier,monospace;font-size:13px;color:#1D2235;padding:5px 0;">{{componentSku}}</td>
  </tr>
  <tr>
    <td style="font-family:Arial,sans-serif;font-size:13px;color:#6B7494;padding:5px 12px 5px 0;">Estoque atual</td>
    <td style="font-family:Arial,sans-serif;font-size:16px;font-weight:700;color:#B45309;padding:5px 0;">{{currentStock}} {{unit}}</td>
  </tr>
  <tr>
    <td style="font-family:Arial,sans-serif;font-size:13px;color:#6B7494;padding:5px 12px 5px 0;">M&iacute;nimo</td>
    <td style="font-family:Arial,sans-serif;font-size:14px;color:#1D2235;padding:5px 0;">{{threshold}} {{unit}}</td>
  </tr>
</table>`, '#FFFBEB', '#FCD34D')}

<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px auto;">
<tr>
  <td style="padding:4px;">${btn('Abrir no painel', '{{restockUrl}}', '#1D2235')}</td>
  <td style="padding:4px;">${btn('Ir ao fornecedor', '{{supplierUrl}}', '#B45309')}</td>
</tr>
</table>`,
      footerNote: 'E-mail interno autom&aacute;tico. Gerencie alertas em /admin/configura&ccedil;&otilde;es/alertas.',
    }),
  },

  // --------------------------------------------------------------------------
  order_component_shortage: {
    slug: 'order_component_shortage',
    label: 'Pedido sem componente em estoque',
    description: 'Aviso interno disparado quando um pedido entra precisando de componente que falta. Pedido NÃO é bloqueado.',
    variables: [
      { name: 'orderNumber', description: 'Número do pedido', example: 'BED-000123' },
      { name: 'customerName', description: 'Nome do cliente', example: 'Maria Silva' },
      { name: 'orderUrl', description: 'Link pro pedido no admin', example: 'https://app.beddesigns.com.br/admin/pedidos/abc' },
      { name: 'shortagesHtml', description: 'HTML cru da lista de componentes em falta (use {{raw.shortagesHtml}})', example: '<li><strong>TAG NFC</strong>: faltam 5 un</li>' },
    ],
    defaultSubject: '⚠️ Pedido {{orderNumber}} precisa de componente que falta — B&D Artes & Impressões',
    defaultHtml: buildEmail({
      preheader: 'Novo pedido entrou precisando de reposição de componentes.',
      accentColor: '#B45309',
      accentBg: '#FEF3C7',
      icon: '&#9888;',
      heading: 'Pedido precisa de reposi&ccedil;&atilde;o',
      content: `
${p('O pedido <strong style="color:#1D2235;">{{orderNumber}}</strong> de <strong style="color:#1D2235;">{{customerName}}</strong> foi recebido, mas precisa de componentes com estoque insuficiente.')}

${infoBox(`<p style="font-family:Arial,sans-serif;font-size:14px;color:#1D7A72;font-weight:600;margin:0;">&#10003;&nbsp; O pedido <strong>N&Atilde;O foi bloqueado</strong> — continue o fluxo normalmente e providencie a reposi&ccedil;&atilde;o o quanto antes.</p>`, '#F0F9F7', '#A7D9D3')}

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0;">
<tr><td bgcolor="#FEF3C7" style="background-color:#FEF3C7;border:1px solid #FCD34D;border-radius:10px;padding:20px 24px;">
  <p style="font-family:Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#92400E;margin:0 0 12px;">Componentes em falta</p>
  <ul style="margin:0;padding-left:20px;color:#92400E;font-family:Arial,sans-serif;font-size:14px;line-height:1.8;">
    {{raw.shortagesHtml}}
  </ul>
</td></tr>
</table>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0;">
<tr><td align="center">${btn('Abrir pedido no painel', '{{orderUrl}}', '#1D2235')}</td></tr>
</table>`,
      footerNote: 'E-mail interno autom&aacute;tico. Gerencie alertas em /admin/configura&ccedil;&otilde;es/alertas.',
    }),
  },
}

export function getCatalog(): EmailTemplateDefinition[] {
  return Object.values(TEMPLATE_CATALOG)
}
