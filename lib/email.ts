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