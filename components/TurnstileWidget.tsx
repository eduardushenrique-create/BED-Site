'use client'

import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: TurnstileRenderOptions) => string
      remove: (id: string) => void
      reset: (id?: string) => void
    }
    onloadTurnstileCallback?: () => void
  }
}

type TurnstileRenderOptions = {
  sitekey: string
  callback?: (token: string) => void
  'error-callback'?: () => void
  'expired-callback'?: () => void
  theme?: 'light' | 'dark' | 'auto'
  size?: 'normal' | 'flexible' | 'compact'
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let scriptLoadingPromise: Promise<void> | null = null

function ensureScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.turnstile) return Promise.resolve()
  if (scriptLoadingPromise) return scriptLoadingPromise

  scriptLoadingPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Turnstile script failed')))
      return
    }
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.addEventListener('load', () => resolve())
    script.addEventListener('error', () => reject(new Error('Turnstile script failed')))
    document.head.appendChild(script)
  })

  return scriptLoadingPromise
}

interface Props {
  onToken: (token: string | null) => void
  className?: string
}

/**
 * Renders the Cloudflare Turnstile widget when NEXT_PUBLIC_TURNSTILE_SITE_KEY
 * is configured. When the env is missing the component renders nothing —
 * forms can call onToken('') or omit the token and the server will skip
 * verification (mirrors lib/turnstile.ts behavior).
 */
export default function TurnstileWidget({ onToken, className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    if (!siteKey || !containerRef.current) return
    let cancelled = false

    ensureScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => onToken(token),
          'error-callback': () => onToken(null),
          'expired-callback': () => onToken(null),
          theme: 'light',
          size: 'flexible',
        })
      })
      .catch(() => {
        // Falha ao carregar script: deixar o usuário continuar sem token; o
        // servidor falha aberto se a env não estiver setada, ou fechado se
        // estiver — não dá pra distinguir aqui.
      })

    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current) } catch { /* noop */ }
        widgetIdRef.current = null
      }
    }
  }, [siteKey, onToken])

  if (!siteKey) return null

  return <div ref={containerRef} className={className} style={{ minHeight: '65px' }} />
}
