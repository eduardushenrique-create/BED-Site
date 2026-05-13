'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const STORAGE_KEY = 'bed_cookie_consent'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (!stored) setVisible(true)
    } catch {
      // localStorage may be blocked — never display banner in that case to avoid loops.
    }
  }, [])

  function decide(value: 'accepted' | 'rejected') {
    try {
      window.localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // ignore
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: 'white',
        borderTop: '1px solid #D8DCE8',
        padding: '16px 24px',
        paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
        boxShadow: '0 -4px 16px rgba(29,34,53,0.08)',
      }}
    >
      <div
        className="container"
        style={{
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ flex: 1, minWidth: '260px', fontSize: '14px', color: '#1D2235', lineHeight: 1.5 }}>
          Usamos cookies essenciais para a sessão de login e cookies analíticos para entender como você usa o site. Você pode aceitar todos ou recusar os opcionais.{' '}
          <Link href="/politica-privacidade" style={{ color: '#4A7AB5', fontWeight: 600 }}>
            Saiba mais
          </Link>
          .
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => decide('rejected')}
            className="focus-ring"
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: '1px solid #D8DCE8',
              background: 'white',
              color: '#1D2235',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'background-color var(--transition-fast)',
            }}
          >
            Recusar opcionais
          </button>
          <button
            type="button"
            onClick={() => decide('accepted')}
            className="focus-ring"
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: 'none',
              background: '#1D2235',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'filter var(--transition-fast)',
            }}
          >
            Aceitar todos
          </button>
        </div>
      </div>
    </div>
  )
}
