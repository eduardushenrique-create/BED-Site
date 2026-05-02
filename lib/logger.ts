import 'server-only'

import pino from 'pino'

/**
 * Structured logger backed by pino.
 *
 * - Em produção: JSON em uma linha (ideal pro Railway/Datadog/etc).
 * - Em dev: também JSON; sem dependência de pino-pretty pra evitar
 *   requisitos de bundling extras. Devs com pino-pretty global podem
 *   pipar: `npm run dev | pino-pretty`.
 *
 * Não envolve PII automaticamente — quem chama é responsável por scrubar
 * dados sensíveis. Para erros que vão pro Sentry, continue usando
 * `captureException` em paralelo.
 */

const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')

const baseOptions: pino.LoggerOptions = {
  level,
  base: {
    env: process.env.NODE_ENV || 'development',
    service: 'bed-site',
  },
  redact: {
    paths: ['password', '*.password', 'token', '*.token', 'authorization', 'cookie', 'set-cookie'],
    censor: '[redacted]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
}

const _logger = pino(baseOptions)

export type LoggerContext = Record<string, unknown>

export const logger = _logger

export function createLogger(context: LoggerContext) {
  return _logger.child(context)
}
