import { writeFileSync } from 'fs'

const STORE_URL = 'https://beddesigns.com.br'

// Inline SVG logo for offline preview
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 40" fill="none" width="130" height="29">
  <g transform="translate(0,4)">
    <polygon points="16,0 28,6 16,12 4,6" fill="#C8552A"/>
    <polygon points="4,6 16,12 16,24 4,18" fill="#8C3519"/>
    <polygon points="28,6 16,12 16,24 28,18" fill="#E07A52"/>
  </g>
  <text x="38" y="27" font-family="Outfit, sans-serif" font-size="20" font-weight="700" fill="#1C1917" letter-spacing="-0.3">forma</text>
  <text x="104" y="27" font-family="Outfit, sans-serif" font-size="20" font-weight="300" fill="#C8552A" letter-spacing="-0.3">3d</text>
</svg>`

const LOGO_HTML = `<a href="${STORE_URL}" style="text-decoration:none;display:inline-block;">${LOGO_SVG}</a>`

function btn(label, href, bg = '#1D2235', fg = '#ffffff') {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px auto;"><tr><td align="center" bgcolor="${bg}" style="background-color:${bg};border-radius:8px;"><a href="${href}" style="display:inline-block;padding:14px 32px;font-family:Arial,sans-serif;font-size:15px;font-weight:600;color:${fg};text-decoration:none;">${label}</a></td></tr></table>`
}

function infoBox(content, bg, border) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0;"><tr><td bgcolor="${bg}" style="background-color:${bg};border:1px solid ${border};border-radius:10px;padding:20px 24px;">${content}</td></tr></table>`
}

function p(text, size = '16px', color = '#44526E') {
  return `<p style="color:${color};font-family:Arial,sans-serif;font-size:${size};line-height:1.7;margin:0 0 16px;">${text}</p>`
}

function hr() {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;"><tr><td style="border-top:1px solid #EDE9E4;font-size:0;line-height:0;">&nbsp;</td></tr></table>`
}

function buildEmail({ preheader, accentColor, accentBg, icon, heading, content, footerNote }) {
  const footer = footerNote ?? 'Dúvidas? Responda este e-mail ou fale conosco pelo WhatsApp.'
  return `<div style="background:${accentColor};padding:4px 16px;font-family:Arial,sans-serif;font-size:10px;color:white;letter-spacing:1px;text-transform:uppercase;text-align:center;">PREVIEW — ${heading}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F5F2EE;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(29,34,53,0.08);">
<tr><td bgcolor="${accentColor}" style="background-color:${accentColor};height:8px;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td align="center" style="padding:28px 48px 24px;border-bottom:1px solid #F0EDE8;">${LOGO_HTML}</td></tr>
<tr><td align="center" style="padding:36px 48px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
<tr><td align="center" valign="middle" width="72" height="72" bgcolor="${accentBg}" style="width:72px;height:72px;background-color:${accentBg};border-radius:36px;font-size:32px;text-align:center;line-height:72px;">${icon}</td></tr>
</table>
</td></tr>
<tr><td align="center" style="padding:20px 48px 4px;">
<h1 style="color:${accentColor};font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;margin:0;line-height:1.3;text-align:center;">${heading}</h1>
</td></tr>
<tr><td style="padding:20px 48px 40px;">${content}</td></tr>
<tr><td bgcolor="#F8F5F2" style="background-color:#F8F5F2;padding:28px 48px;text-align:center;border-top:1px solid #EDE9E4;">
<p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:13px;"><a href="${STORE_URL}" style="color:#1D2235;text-decoration:none;font-weight:600;">BED Design</a></p>
<p style="margin:0;color:#6B7494;font-family:Arial,sans-serif;font-size:12px;">${footer}</p>
</td></tr>
</table>
</td></tr>
</table>`
}

// ─── Templates com dados de exemplo ──────────────────────────────────────────

const templates = [
  {
    id: 't1',
    label: '1. Confirmação de Pedido',
    html: buildEmail({
      preheader: 'Seu pedido foi recebido!',
      accentColor: '#1D7A72',
      accentBg: '#E0F4F0',
      icon: '✓',
      heading: 'Pedido confirmado!',
      content: p('Obrigado pela sua compra, <strong style="color:#1D2235;">Maria Silva</strong>! Seu pedido foi recebido com sucesso e já está em nossa fila.')
        + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:4px 0 24px;">
<tr><td align="center" bgcolor="#F0F9F7" style="background-color:#F0F9F7;border:1px solid #A7D9D3;border-radius:10px;padding:20px;">
  <p style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#1D7A72;margin:0 0 6px;font-weight:600;">Número do pedido</p>
  <p style="font-family:'Courier New',Courier,monospace;font-size:22px;font-weight:700;color:#1D2235;margin:0;letter-spacing:1px;">BED-000123</p>
</td></tr>
</table>`
        + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:0 0 20px;">
<thead><tr>
  <th align="left" style="font-family:Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#6B7494;padding:0 12px 10px 0;border-bottom:2px solid #EDE9E4;">Produto</th>
  <th align="right" style="font-family:Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#6B7494;padding:0 0 10px;border-bottom:2px solid #EDE9E4;">Valor</th>
</tr></thead>
<tbody>
<tr>
  <td style="font-family:Arial,sans-serif;font-size:14px;color:#1D2235;padding:10px 12px 10px 0;">Chaveiro Personalizado × 2</td>
  <td align="right" style="font-family:Arial,sans-serif;font-size:14px;color:#1D2235;padding:10px 0;">R$ 98,00</td>
</tr>
<tr>
  <td style="font-family:Arial,sans-serif;font-size:14px;color:#1D2235;padding:10px 12px 10px 0;">Porta-retrato 3D × 1</td>
  <td align="right" style="font-family:Arial,sans-serif;font-size:14px;color:#1D2235;padding:10px 0;">R$ 149,90</td>
</tr>
<tr><td colspan="2" style="border-top:2px solid #EDE9E4;padding:0;font-size:0;line-height:0;"></td></tr>
<tr>
  <td style="font-family:Arial,sans-serif;font-size:16px;font-weight:600;color:#1D2235;padding:12px 0 0;">Total</td>
  <td align="right" style="font-family:Arial,sans-serif;font-size:20px;font-weight:700;color:#1D7A72;padding:12px 0 0;">R$ 247,90</td>
</tr>
</tbody>
</table>`
        + p('Em breve seu pedido entrará em produção. Você receberá atualizações por e-mail em cada etapa. Qualquer dúvida, é só responder este e-mail.', '14px', '#6B7494'),
    }),
  },
  {
    id: 't2',
    label: '2. Pagamento Aprovado',
    html: buildEmail({
      preheader: 'Pagamento confirmado! Seu pedido vai entrar em produção.',
      accentColor: '#1D7A72',
      accentBg: '#E0F4F0',
      icon: '💰',
      heading: 'Pagamento aprovado!',
      content: p('Ótima notícia, <strong style="color:#1D2235;">Maria Silva</strong>! O pagamento do seu pedido foi confirmado.')
        + infoBox(
            `<p style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#1D7A72;margin:0 0 6px;font-weight:600;">Pedido</p>
            <p style="font-family:'Courier New',monospace;font-size:22px;font-weight:700;color:#1D2235;margin:0;">BED-000123</p>`,
            '#F0F9F7', '#A7D9D3')
        + p('Agora seu pedido vai entrar em produção. Cada peça é produzida sob demanda com muito cuidado. Assim que estiver pronta, você receberá o código de rastreio.')
        + p('Agradecemos a confiança! 😊', '14px', '#6B7494'),
    }),
  },
  {
    id: 't3',
    label: '3. Pedido em Produção',
    html: buildEmail({
      preheader: 'Uhu! Seu pedido entrou em produção.',
      accentColor: '#C8552A',
      accentBg: '#FAE8DF',
      icon: '⚙',
      heading: 'Em produção!',
      content: p('Olá, <strong style="color:#1D2235;">Maria</strong>! Seu pedido <strong style="color:#1D2235;">BED-000123</strong> acabou de entrar em produção.')
        + infoBox(
            `<p style="font-family:Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#C8552A;margin:0 0 14px;">Progresso do pedido</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr><td style="font-family:Arial,sans-serif;font-size:14px;color:#1D7A72;padding:5px 0;">✓ Pedido recebido e pagamento confirmado</td></tr>
              <tr><td style="font-family:Arial,sans-serif;font-size:14px;color:#C8552A;font-weight:600;padding:5px 0;">▶ Em produção agora</td></tr>
              <tr><td style="font-family:Arial,sans-serif;font-size:14px;color:#A8AFCA;padding:5px 0;">● Enviado para os Correios</td></tr>
              <tr><td style="font-family:Arial,sans-serif;font-size:14px;color:#A8AFCA;padding:5px 0;">● Entregue</td></tr>
            </table>`,
            '#FFF8F5', '#F0C9B5')
        + p('Cada peça é impressa sob demanda com muito cuidado. Assim que estiver pronta e postada, você receberá o código de rastreio por e-mail.', '14px', '#6B7494'),
    }),
  },
  {
    id: 't4',
    label: '4. Pedido Enviado',
    html: buildEmail({
      preheader: 'Seu pedido foi postado! Acompanhe pelo código de rastreio.',
      accentColor: '#2563EB',
      accentBg: '#DBEAFE',
      icon: '📦',
      heading: 'Pedido enviado!',
      content: p('Seu pedido <strong style="color:#1D2235;">BED-000123</strong> foi postado e já está a caminho!')
        + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 20px;">
<tr><td align="center" bgcolor="#EFF6FF" style="background-color:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;padding:28px 24px;">
  <p style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#2563EB;margin:0 0 10px;font-weight:600;">Código de rastreio</p>
  <p style="font-family:'Courier New',monospace;font-size:24px;font-weight:700;color:#1D2235;margin:0 0 20px;letter-spacing:2px;">BR123456789BR</p>
  ${btn('Rastrear nos Correios', 'https://www.correios.com.br/rastrear-encomendas?objetos=BR123456789BR', '#2563EB')}
</td></tr>
</table>`
        + p('Prazo de entrega: veja o código de rastreio acima para a estimativa mais recente. Prazos podem variar por região e período.', '14px', '#6B7494'),
    }),
  },
  {
    id: 't5',
    label: '5. Pedido Entregue',
    html: buildEmail({
      preheader: 'Seu pedido foi entregue! Esperamos que você ame.',
      accentColor: '#1D7A72',
      accentBg: '#E0F4F0',
      icon: '🎁',
      heading: 'Pedido entregue!',
      content: p('O pedido <strong style="color:#1D2235;">BED-000123</strong> foi marcado como entregue. Esperamos que você ame!')
        + infoBox(
            `<p style="font-family:Arial,sans-serif;font-size:14px;color:#1D7A72;font-weight:600;margin:0 0 6px;">Obrigado por comprar na BED Design 😊</p>
            <p style="font-family:Arial,sans-serif;font-size:14px;color:#44526E;margin:0;line-height:1.6;">
              Cada peça é feita com muito carinho. Se tiver qualquer dúvida sobre o produto ou o pedido, é só responder este e-mail.
            </p>`,
            '#F0F9F7', '#A7D9D3')
        + p('Quer compartilhar como ficou? Marque a gente nas redes sociais! Adoramos ver as fotos dos nossos clientes. 📸', '14px', '#6B7494'),
    }),
  },
  {
    id: 't6',
    label: '6. Estorno do Pedido',
    html: buildEmail({
      preheader: 'Estorno solicitado. O valor será devolvido em breve.',
      accentColor: '#7C3AED',
      accentBg: '#EDE9FE',
      icon: '↩',
      heading: 'Estorno em andamento',
      content: p('Olá, <strong style="color:#1D2235;">Maria</strong>!')
        + p('O reembolso do pedido <strong style="color:#1D2235;">BED-000123</strong> no valor de <strong style="color:#7C3AED;">R$ 99,90</strong> foi solicitado ao Mercado Pago e está sendo processado.')
        + infoBox(
            `<p style="font-family:Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#7C3AED;margin:0 0 14px;">Prazo para recebimento</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr><td style="font-family:Arial,sans-serif;font-size:14px;color:#44526E;padding:5px 0;"><strong style="color:#1D2235;">Pix:</strong> até 1 dia útil</td></tr>
              <tr><td style="font-family:Arial,sans-serif;font-size:14px;color:#44526E;padding:5px 0;"><strong style="color:#1D2235;">Cartão de crédito:</strong> até 2 faturas (conforme banco emissor)</td></tr>
              <tr><td style="font-family:Arial,sans-serif;font-size:14px;color:#44526E;padding:5px 0;"><strong style="color:#1D2235;">Boleto:</strong> até 5 dias úteis</td></tr>
            </table>`,
            '#F5F0FF', '#DDD6FE')
        + p('Qualquer dúvida sobre o estorno, responda este e-mail. Lamentamos qualquer inconveniência.', '14px', '#6B7494'),
    }),
  },
  {
    id: 't7',
    label: '7. Redefinição de Senha (Admin)',
    html: buildEmail({
      preheader: 'Solicitação de redefinição de senha de administrador.',
      accentColor: '#1D2235',
      accentBg: '#EEF1F8',
      icon: '🔒',
      heading: 'Redefinição de senha',
      content: p('Olá, <strong style="color:#1D2235;">Edu</strong>!')
        + p('Recebemos uma solicitação para redefinir a senha da sua conta de administrador. Clique no botão abaixo para escolher uma nova senha.')
        + btn('Redefinir minha senha', 'https://beddesigns.com.br/login/redefinir-senha?token=abc123', '#1D2235')
        + infoBox(
            `<p style="font-family:Arial,sans-serif;font-size:13px;color:#44526E;margin:0;line-height:1.6;">⏱ <strong>O link expira em 1 hora.</strong> Se não funcionar mais, solicite outro acesso pelo painel de login.</p>`,
            '#FFFBEB', '#FCD34D')
        + hr()
        + p('Se o botão não funcionar, copie e cole este link no navegador:', '13px', '#6B7494')
        + `<p style="font-family:'Courier New',monospace;font-size:12px;color:#2563EB;word-break:break-all;margin:0 0 20px;line-height:1.6;">https://beddesigns.com.br/login/redefinir-senha?token=abc123</p>`
        + p('Se você não solicitou esta redefinição, ignore este e-mail com segurança. Sua senha permanece a mesma.', '13px', '#6B7494'),
      footerNote: 'Este e-mail foi enviado para a conta de administrador da BED Design.',
    }),
  },
  {
    id: 't8',
    label: '8. Código de Acesso (OTP)',
    html: buildEmail({
      preheader: 'Seu código de acesso de 6 dígitos. Expira em 10 minutos.',
      accentColor: '#C8552A',
      accentBg: '#FAE8DF',
      icon: '🔑',
      heading: 'Código de acesso',
      content: p('Use o código abaixo para entrar na sua conta. Ele expira em <strong>10 minutos</strong>.')
        + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 24px;">
<tr><td align="center" bgcolor="#F8F5F2" style="background-color:#F8F5F2;border:2px dashed #D8B8A8;border-radius:12px;padding:36px 24px;">
  <p style="font-family:'Courier New',Courier,monospace;font-size:48px;font-weight:700;color:#C8552A;margin:0;letter-spacing:14px;text-align:center;">123456</p>
</td></tr>
</table>`
        + p('Não compartilhe este código com ninguém. A BED Design nunca solicitará seu código por telefone ou chat.', '13px', '#6B7494')
        + p('Se você não solicitou este código, ignore este e-mail. Sua conta está segura.', '13px', '#6B7494'),
    }),
  },
  {
    id: 't9',
    label: '9. Produto Voltou ao Estoque',
    html: buildEmail({
      preheader: 'Boa notícia! O produto que você queria está disponível novamente.',
      accentColor: '#1D7A72',
      accentBg: '#E0F4F0',
      icon: '🔔',
      heading: 'Boa notícia!',
      content: p('O produto que você pediu para ser avisado(a) está disponível novamente:')
        + infoBox(
            `<p style="font-family:Arial,sans-serif;font-size:18px;font-weight:700;color:#1D2235;margin:0;text-align:center;">Chaveiro Personalizado NFC</p>`,
            '#F0F9F7', '#A7D9D3')
        + p('Não deixe para depois — produtos personalizados podem voltar a esgotar rapidamente!', '14px', '#44526E')
        + btn('Ver produto agora', 'https://beddesigns.com.br/produtos/chaveiro-personalizado-nfc', '#1D7A72')
        + hr()
        + p('Você recebeu este e-mail porque pediu para ser avisado(a) quando este produto voltasse ao estoque.', '12px', '#A8AFCA'),
    }),
  },
  {
    id: 't10',
    label: '10. Estoque Baixo — Interno',
    html: buildEmail({
      preheader: 'Componente abaixo do mínimo. Providencie reposição.',
      accentColor: '#B45309',
      accentBg: '#FEF3C7',
      icon: '⚠',
      heading: 'Estoque baixo',
      content: p('O componente abaixo atingiu o estoque mínimo configurado. Providencie a reposição para evitar atrasos nos pedidos.')
        + infoBox(
            `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="font-family:Arial,sans-serif;font-size:13px;color:#6B7494;padding:5px 12px 5px 0;width:130px;">Componente</td>
                <td style="font-family:Arial,sans-serif;font-size:14px;font-weight:600;color:#1D2235;padding:5px 0;">TAG NFC 13.56MHz</td>
              </tr>
              <tr>
                <td style="font-family:Arial,sans-serif;font-size:13px;color:#6B7494;padding:5px 12px 5px 0;">SKU</td>
                <td style="font-family:'Courier New',Courier,monospace;font-size:13px;color:#1D2235;padding:5px 0;">NFC-001</td>
              </tr>
              <tr>
                <td style="font-family:Arial,sans-serif;font-size:13px;color:#6B7494;padding:5px 12px 5px 0;">Estoque atual</td>
                <td style="font-family:Arial,sans-serif;font-size:16px;font-weight:700;color:#B45309;padding:5px 0;">8 un</td>
              </tr>
              <tr>
                <td style="font-family:Arial,sans-serif;font-size:13px;color:#6B7494;padding:5px 12px 5px 0;">Mínimo</td>
                <td style="font-family:Arial,sans-serif;font-size:14px;color:#1D2235;padding:5px 0;">10 un</td>
              </tr>
            </table>`,
            '#FFFBEB', '#FCD34D')
        + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px auto;">
<tr>
  <td style="padding:4px;">${btn('Abrir no painel', 'https://beddesigns.com.br/admin/componentes/nfc-001', '#1D2235')}</td>
  <td style="padding:4px;">${btn('Ir ao fornecedor', 'https://fornecedor.com/tag-nfc', '#B45309')}</td>
</tr>
</table>`,
      footerNote: 'E-mail interno automático. Gerencie alertas em /admin/configurações/alertas.',
    }),
  },
  {
    id: 't11',
    label: '11. Pedido sem Componente — Interno',
    html: buildEmail({
      preheader: 'Novo pedido entrou precisando de reposição de componentes.',
      accentColor: '#B45309',
      accentBg: '#FEF3C7',
      icon: '⚠',
      heading: 'Pedido precisa de reposição',
      content: p('O pedido <strong style="color:#1D2235;">BED-000123</strong> de <strong style="color:#1D2235;">Maria Silva</strong> foi recebido, mas precisa de componentes com estoque insuficiente.')
        + infoBox(
            `<p style="font-family:Arial,sans-serif;font-size:14px;color:#1D7A72;font-weight:600;margin:0;">✓ O pedido NÃO foi bloqueado — continue o fluxo normalmente e providencie a reposição o quanto antes.</p>`,
            '#F0F9F7', '#A7D9D3')
        + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0;">
<tr><td bgcolor="#FEF3C7" style="background-color:#FEF3C7;border:1px solid #FCD34D;border-radius:10px;padding:20px 24px;">
  <p style="font-family:Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#92400E;margin:0 0 12px;">Componentes em falta</p>
  <ul style="margin:0;padding-left:20px;color:#92400E;font-family:Arial,sans-serif;font-size:14px;line-height:1.8;">
    <li><strong>TAG NFC 13.56MHz</strong>: faltam 5 un</li>
    <li><strong>Filamento PLA Branco</strong>: faltam 2 un</li>
  </ul>
</td></tr>
</table>`
        + btn('Abrir pedido no painel', 'https://beddesigns.com.br/admin/pedidos/bed-000123', '#1D2235'),
      footerNote: 'E-mail interno automático. Gerencie alertas em /admin/configurações/alertas.',
    }),
  },
]

// ─── Compose full HTML document ───────────────────────────────────────────────

const navLinks = templates.map(t => `<a href="#${t.id}">${t.label.replace(/^\d+\.\s*/, '')}</a>`).join('\n')

const sections = templates.map(t => `
<div class="section" id="${t.id}">
  <div class="section-label">${t.label}</div>
  <div class="email-wrapper">${t.html}</div>
</div>`).join('\n')

const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Preview: Templates de E-mail — BED Design</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #0F1117; font-family: -apple-system, Arial, sans-serif; }
  .nav {
    position: sticky; top: 0; background: #1D2235; padding: 12px 20px;
    display: flex; gap: 6px; flex-wrap: wrap; z-index: 100;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    align-items: center;
  }
  .nav-title { color: #E4EDF8; font-size: 13px; font-weight: 700; margin-right: 8px; }
  .nav a {
    color: #8AAFD8; text-decoration: none; font-size: 11px;
    padding: 4px 8px; border-radius: 4px; border: 1px solid #2E3650;
    white-space: nowrap;
  }
  .nav a:hover { background: #2E3650; color: #E4EDF8; }
  .section { margin: 48px 0; }
  .section-label {
    color: #8AAFD8; font-size: 12px; font-weight: 700; letter-spacing: 1.5px;
    text-transform: uppercase; padding: 8px 24px 12px;
  }
  .email-wrapper { background: #F5F2EE; }
</style>
</head>
<body>
<div class="nav">
  <span class="nav-title">BED Design — E-mails</span>
  ${navLinks}
</div>
${sections}
</body>
</html>`

writeFileSync('email-preview.html', fullHtml, 'utf8')
console.log(`✓ Preview gerado: email-preview.html (${Math.round(fullHtml.length / 1024)} KB)`)
console.log('  Abra o arquivo no navegador para visualizar todos os 11 templates.')
