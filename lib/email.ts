import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM_EMAIL = 'Forma 3D <noreply@forma3d.com.br>'

interface OrderEmailData {
  orderNumber: string
  customerName: string
  customerEmail: string
  items: Array<{
    name: string
    quantity: number
    price: number
  }>
  total: number
  shippingAddress?: {
    street: string
    number: string
    city: string
    state: string
  }
}

export async function sendOrderConfirmation(data: OrderEmailData): Promise<boolean> {
  if (!resend) {
    console.warn('Resend not configured, skipping email')
    return true
  }

  try {
    const itemsHtml = data.items
      .map(item => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #E8E2DA;">
            ${item.name}
            <br><span style="color: #78716C; font-size: 14px;">Quantidade: ${item.quantity}</span>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #E8E2DA; text-align: right;">
            R$ ${item.price.toFixed(2).replace('.', ',')}
          </td>
        </tr>
      `)
      .join('')

    await resend.emails.send({
      from: FROM_EMAIL,
      to: data.customerEmail,
      subject: `Pedido ${data.orderNumber} confirmado - Forma 3D`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body style="font-family: 'DM Sans', Arial, sans-serif; background-color: #F5F2EE; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 32px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #C8552A; font-size: 28px; margin: 0;">Forma 3D</h1>
            </div>

            <div style="text-align: center; margin-bottom: 32px;">
              <div style="width: 60px; height: 60px; background-color: #1D7A72; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              </div>
              <h2 style="color: #1C1917; font-size: 24px; margin: 0 0 8px 0;">Pedido confirmado!</h2>
              <p style="color: #78716C; margin: 0;">Obrigado pela sua compra, ${data.customerName}!</p>
            </div>

            <div style="background-color: #F5F2EE; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
              <p style="color: #78716C; font-size: 14px; margin: 0 0 4px 0;">Número do pedido</p>
              <p style="color: #1C1917; font-size: 20px; font-weight: 600; margin: 0; font-family: monospace;">${data.orderNumber}</p>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <thead>
                <tr>
                  <th style="text-align: left; padding: 12px; border-bottom: 2px solid #E8E2DA; color: #78716C; font-size: 14px;">Produto</th>
                  <th style="text-align: right; padding: 12px; border-bottom: 2px solid #E8E2DA; color: #78716C; font-size: 14px;">Valor</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
                <tr>
                  <td style="padding: 12px; font-weight: 600;">Total</td>
                  <td style="padding: 12px; text-align: right; font-weight: 600; font-size: 18px;">R$ ${data.total.toFixed(2).replace('.', ',')}</td>
                </tr>
              </tbody>
            </table>

            <p style="color: #78716C; font-size: 14px; line-height: 1.6;">
              Seu pedido foi recebido e我们将尽快开始生产。 Você receberá atualizações por e-mail sobre ostatus do seu pedido.
            </p>

            <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #E8E2DA; text-align: center;">
              <p style="color: #78716C; font-size: 14px; margin: 0;">
                Precisa de ajuda? Entre em contato pelo WhatsApp ou responde este e-mail.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    })

    return true
  } catch (error) {
    console.error('Error sending confirmation email:', error)
    return false
  }
}

export async function sendAccessCodeEmail(email: string, code: string): Promise<boolean> {
  if (!resend) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[auth] Código de acesso para ${email}: ${code}`)
    }
    return true
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Seu código de acesso - B&D Artes & Impressões',
      html: `
        <div style="font-family: Arial, sans-serif; color: #1D2235;">
          <h2>Seu código de acesso</h2>
          <p>Use o código abaixo para entrar na loja. Ele expira em 10 minutos.</p>
          <p style="font-size: 28px; letter-spacing: 6px; font-weight: 700;">${code}</p>
          <p>Se você não solicitou este acesso, ignore este e-mail.</p>
        </div>
      `,
    })
    return true
  } catch (error) {
    console.error('Error sending access code email:', error)
    return false
  }
}

export async function sendPaymentApproved(data: OrderEmailData): Promise<boolean> {
  if (!resend) return true

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: data.customerEmail,
      subject: `Pagamento aprovado - Pedido ${data.orderNumber} - Forma 3D`,
      html: `
        <h2>Pagamento aprovado!</h2>
        <p>Olá ${data.customerName}, o pagamento do seu pedido ${data.orderNumber} foi aprovado!</p>
        <p>Em breve seu pedido entrará em produção.</p>
      `,
    })
    return true
  } catch (error) {
    console.error('Error sending payment approved email:', error)
    return false
  }
}

export async function sendPasswordResetEmail(
  email: string,
  name: string,
  resetUrl: string,
): Promise<boolean> {
  if (!resend) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[auth] Link de redefinição de senha para ${email}: ${resetUrl}`)
    }
    return true
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Redefinição de senha - B&D Artes & Impressões',
      html: `
        <div style="font-family: Arial, sans-serif; color: #1D2235; max-width: 560px; margin: 0 auto;">
          <h2 style="color: #1D2235;">Olá${name ? `, ${name.split(' ')[0]}` : ''}!</h2>
          <p>Recebemos uma solicitação para redefinir a senha da sua conta de administrador.</p>
          <p>Clique no botão abaixo para escolher uma nova senha. O link expira em 1 hora.</p>
          <p style="margin: 32px 0;">
            <a href="${resetUrl}" style="display: inline-block; padding: 14px 28px; background: #1D2235; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
              Redefinir senha
            </a>
          </p>
          <p style="color: #6B7494; font-size: 14px;">Se o botão não funcionar, copie e cole este link no navegador:</p>
          <p style="color: #6B7494; font-size: 13px; word-break: break-all;">${resetUrl}</p>
          <hr style="border: none; border-top: 1px solid #E3E9F4; margin: 24px 0;" />
          <p style="color: #6B7494; font-size: 13px;">Se você não solicitou esta redefinição, ignore este e-mail. Sua senha continua a mesma.</p>
        </div>
      `,
    })
    return true
  } catch (error) {
    console.error('Error sending password reset email:', error)
    return false
  }
}

export async function sendOrderInProduction(
  email: string,
  customerName: string,
  orderNumber: string,
): Promise<boolean> {
  if (!resend) return true

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Pedido ${orderNumber} entrou em produção - Forma 3D`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #1D2235; max-width: 560px; margin: 0 auto;">
          <h2 style="color: #1D2235;">Olá${customerName ? `, ${customerName.split(' ')[0]}` : ''}!</h2>
          <p>Boa notícia: seu pedido <strong>${orderNumber}</strong> entrou em produção.</p>
          <p>Cada peça é impressa sob demanda. Assim que estiver pronta para envio, enviaremos um novo aviso com o código de rastreio.</p>
          <p style="color: #6B7494; font-size: 13px;">Qualquer dúvida, é só responder este e-mail.</p>
        </div>
      `,
    })
    return true
  } catch (error) {
    console.error('Error sending in-production email:', error)
    return false
  }
}

export async function sendOrderRefunded(
  email: string,
  customerName: string,
  orderNumber: string,
  amount: number,
): Promise<boolean> {
  if (!resend) return true

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Estorno do pedido ${orderNumber} - Forma 3D`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #1D2235; max-width: 560px; margin: 0 auto;">
          <h2 style="color: #8B5CF6;">Estorno em processamento</h2>
          <p>Olá${customerName ? `, ${customerName.split(' ')[0]}` : ''},</p>
          <p>O reembolso do pedido <strong>${orderNumber}</strong> no valor de <strong>R$ ${amount.toFixed(2).replace('.', ',')}</strong> foi solicitado ao Mercado Pago.</p>
          <p>O valor deve voltar para a sua forma de pagamento original em até 7 dias úteis (cartão) ou imediatamente (Pix), conforme as regras do banco emissor.</p>
          <p style="color: #6B7494; font-size: 13px;">Qualquer dúvida, é só responder este e-mail.</p>
        </div>
      `,
    })
    return true
  } catch (error) {
    console.error('Error sending refunded email:', error)
    return false
  }
}

export async function sendOrderDelivered(
  email: string,
  orderNumber: string,
): Promise<boolean> {
  if (!resend) return true

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Pedido ${orderNumber} entregue! - Forma 3D`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #1D2235; max-width: 560px; margin: 0 auto;">
          <h2 style="color: #1D7A72;">Seu pedido foi entregue!</h2>
          <p>O pedido <strong>${orderNumber}</strong> foi marcado como entregue.</p>
          <p>Esperamos que você ame o que pediu! Se tiver qualquer feedback ou problema, é só responder este e-mail.</p>
        </div>
      `,
    })
    return true
  } catch (error) {
    console.error('Error sending delivered email:', error)
    return false
  }
}

export async function sendRestockAlertEmail(
  email: string,
  productName: string,
  productSlug: string,
  appUrl: string,
): Promise<boolean> {
  if (!resend) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[restock] ${productName} disponível para ${email}`)
    }
    return true
  }

  try {
    const productUrl = `${appUrl.replace(/\/$/, '')}/produtos/${productSlug}`
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `${productName} voltou! - B&D Artes & Impressões`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #1D2235; max-width: 560px; margin: 0 auto;">
          <h2 style="color: #1D7A72;">Boa notícia!</h2>
          <p>O produto <strong>${productName}</strong> está disponível novamente.</p>
          <p style="margin: 24px 0;">
            <a href="${productUrl}" style="display: inline-block; padding: 12px 22px; background: #1D2235; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
              Ver produto
            </a>
          </p>
          <p style="color: #6B7494; font-size: 13px;">Você recebeu este e-mail porque pediu para ser avisado quando este produto voltasse ao estoque.</p>
        </div>
      `,
    })
    return true
  } catch (error) {
    console.error('Error sending restock alert email:', error)
    return false
  }
}

export async function sendOrderShipped(
  email: string,
  orderNumber: string,
  trackingCode: string
): Promise<boolean> {
  if (!resend) return true

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Pedido ${orderNumber} enviado! - Forma 3D`,
      html: `
        <h2>Seu pedido foi enviado!</h2>
        <p>O pedido ${orderNumber} foi postado e está a caminho.</p>
        <p>Código de rastreamento: <strong>${trackingCode}</strong></p>
        <p>Acompanhe o entrega pelo site dos Correios.</p>
      `,
    })
    return true
  } catch (error) {
    console.error('Error sending shipped email:', error)
    return false
  }
}
