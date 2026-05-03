import 'server-only'

import { Resend } from 'resend'
import prisma from '@/lib/prisma'
import { hasDatabase } from '@/lib/database'
import { parseSegment, resolveSegment, type EmailSegment } from '@/lib/email-segments'
import { appendUnsubscribeFooter } from '@/lib/email-unsubscribe'
import { captureException } from '@/lib/observability'
import { createLogger } from '@/lib/logger'

const log = createLogger({ component: 'email-dispatcher' })

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'BED Design <noreply@beddesigns.com.br>'
const REPLY_TO_EMAIL = process.env.RESEND_REPLY_TO_EMAIL || 'eduardus.henrique@gmail.com'

/**
 * Resend free plan limita a ~10 req/s. Mandamos batches de 5 com 600ms entre
 * eles → ~8 req/s, ficando confortavelmente abaixo do teto. Em planos maiores
 * dá pra subir BATCH_SIZE/diminuir BATCH_DELAY_MS via env, sem mudança de
 * código.
 */
const BATCH_SIZE = Number(process.env.EMAIL_DISPATCH_BATCH_SIZE) || 5
const BATCH_DELAY_MS = Number(process.env.EMAIL_DISPATCH_BATCH_DELAY_MS) || 600

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

interface DispatchResult {
  ok: boolean
  campaignId: string
  recipientCount: number
  sentCount: number
  failedCount: number
  reason?: string
}

/**
 * Dispara uma campanha em background. NUNCA bloqueia o caller —
 * `dispatchCampaign()` é chamado a partir do endpoint /dispatch e o handler
 * retorna 202 imediatamente. O loop assíncrono atualiza a campanha no banco
 * conforme avança.
 *
 * Idempotência: o handler /dispatch só permite começar se o status atual é
 * `draft` ou `scheduled`. Após `sending`, novas chamadas retornam 409.
 *
 * Falha de rede no Resend é tratada por destinatário — uma falha não derruba
 * a campanha inteira; só incrementa failedCount. No fim, status vira `sent`
 * (mesmo que com falhas) ou `failed` se NADA saiu.
 */
export async function dispatchCampaign(campaignId: string, appUrl: string): Promise<DispatchResult> {
  if (!hasDatabase || !prisma?.emailCampaign) {
    return { ok: false, campaignId, recipientCount: 0, sentCount: 0, failedCount: 0, reason: 'no_database' }
  }
  if (!resend) {
    return { ok: false, campaignId, recipientCount: 0, sentCount: 0, failedCount: 0, reason: 'resend_not_configured' }
  }

  const campaign = await prisma.emailCampaign.findUnique({ where: { id: campaignId } })
  if (!campaign) {
    return { ok: false, campaignId, recipientCount: 0, sentCount: 0, failedCount: 0, reason: 'not_found' }
  }

  const segment = parseSegment(campaign.segment)
  if (!segment) {
    await markFailed(campaignId, 'invalid_segment')
    return { ok: false, campaignId, recipientCount: 0, sentCount: 0, failedCount: 0, reason: 'invalid_segment' }
  }

  // Calcula a lista DEFINITIVA agora — congela no momento do disparo.
  // Quem se descadastrar entre agora e o último envio não receberá (filtro
  // já aplicado em resolveSegment, que sempre desconta EmailUnsubscribe).
  const { emails } = await resolveSegment(segment)
  const recipientCount = emails.length

  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: {
      status: 'sending',
      startedAt: new Date(),
      recipientCount,
      sentCount: 0,
      failedCount: 0,
    },
  })

  if (recipientCount === 0) {
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: 'sent', finishedAt: new Date() },
    })
    return { ok: true, campaignId, recipientCount: 0, sentCount: 0, failedCount: 0 }
  }

  let sentCount = 0
  let failedCount = 0

  for (let offset = 0; offset < emails.length; offset += BATCH_SIZE) {
    const batch = emails.slice(offset, offset + BATCH_SIZE)
    await Promise.all(
      batch.map(async email => {
        try {
          const html = appendUnsubscribeFooter(campaign.htmlBody, appUrl, email)
          await resend!.emails.send({
            from: FROM_EMAIL,
            replyTo: REPLY_TO_EMAIL,
            to: email,
            subject: campaign.subject,
            html,
            ...(campaign.textBody ? { text: campaign.textBody } : {}),
          })
          sentCount += 1
        } catch (error) {
          failedCount += 1
          captureException(error, {
            context: 'email-dispatcher',
            detail: 'resend send failed',
            campaignId,
            email,
          })
        }
      }),
    )

    // Persiste progresso a cada batch — UI consegue acompanhar.
    try {
      await prisma.emailCampaign.update({
        where: { id: campaignId },
        data: { sentCount, failedCount },
      })
    } catch (error) {
      log.warn({ err: error, campaignId }, 'failed to persist progress, continuing')
    }

    if (offset + BATCH_SIZE < emails.length) {
      await sleep(BATCH_DELAY_MS)
    }
  }

  // Status final: 'sent' se ao menos 1 saiu; 'failed' se TUDO falhou.
  const finalStatus = sentCount > 0 ? 'sent' : 'failed'
  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: {
      status: finalStatus,
      finishedAt: new Date(),
      sentCount,
      failedCount,
    },
  })

  log.info({ campaignId, recipientCount, sentCount, failedCount, finalStatus }, 'campaign dispatch finished')

  return { ok: true, campaignId, recipientCount, sentCount, failedCount }
}

async function markFailed(campaignId: string, reason: string) {
  if (!hasDatabase || !prisma?.emailCampaign) return
  try {
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: 'failed', finishedAt: new Date() },
    })
    log.error({ campaignId, reason }, 'campaign dispatch aborted')
  } catch {
    // ignora — banco caiu, não há o que fazer.
  }
}

/**
 * Para uso em rotinas internas que querem disparar imediatamente sem
 * esperar conclusão. Loga em background; nunca lança.
 */
export function dispatchCampaignInBackground(campaignId: string, appUrl: string): void {
  void dispatchCampaign(campaignId, appUrl).catch(error => {
    captureException(error, { context: 'email-dispatcher', detail: 'background dispatch crashed', campaignId })
  })
}

/** Re-exportado pra testes locais. */
export type { EmailSegment }
