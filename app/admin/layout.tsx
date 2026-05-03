'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import BrandLogo from '@/components/BrandLogo'

type NavItem = { href: string; label: string; exact?: boolean; badgeKey?: 'lowStock' }

const navItems: NavItem[] = [
  { href: '/admin', label: 'Painel', exact: true },
  { href: '/admin/pedidos', label: 'Pedidos' },
  { href: '/admin/producao', label: 'Produção' },
  { href: '/admin/impressoras', label: 'Impressoras' },
  { href: '/admin/clientes', label: 'Clientes' },
  { href: '/admin/produtos', label: 'Produtos' },
  { href: '/admin/componentes', label: 'Componentes', badgeKey: 'lowStock' },
  { href: '/admin/categorias', label: 'Categorias' },
  { href: '/admin/banners', label: 'Banners' },
  { href: '/admin/cupons', label: 'Cupons' },
  { href: '/admin/avaliacoes', label: 'Avaliações' },
  { href: '/admin/emails', label: 'E-mails' },
  { href: '/admin/auditoria', label: 'Auditoria' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [lowStockCount, setLowStockCount] = useState<number>(0)

  // Refetch sempre que muda de rota — barato e mantém badge atualizado
  // sem precisar de WebSocket/polling.
  useEffect(() => {
    let cancelled = false
    fetch('/api/componentes/baixa', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!cancelled && data && typeof data.count === 'number') {
          setLowStockCount(data.count)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [pathname])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#F0F5FB' }}>
      <aside style={{
        width: '252px',
        backgroundColor: '#1D2235',
        color: '#F0F5FB',
        padding: '24px 0',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        position: 'sticky',
        top: 0,
        borderRight: '1px solid rgba(240,245,251,0.08)',
      }}>
        <div style={{ padding: '0 24px', marginBottom: '32px' }}>
          <BrandLogo href="/" dark={false} size="md" />
          <span style={{ fontSize: '12px', color: 'rgba(240,245,251,0.64)', display: 'block', marginTop: '10px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Admin B&D
          </span>
        </div>

        <nav style={{ display: 'grid', gap: '6px', padding: '0 12px' }}>
          {navItems.map(item => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`)
            const badgeCount = item.badgeKey === 'lowStock' ? lowStockCount : 0

            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  padding: '12px 16px',
                  color: active ? '#F0F5FB' : 'rgba(240,245,251,0.72)',
                  backgroundColor: active ? 'rgba(187,207,235,0.14)' : 'transparent',
                  borderLeft: active ? '3px solid #D4849A' : '3px solid transparent',
                  borderRadius: '0 12px 12px 0',
                  fontWeight: active ? 700 : 500,
                }}
              >
                <span>{item.label}</span>
                {badgeCount > 0 && (
                  <span
                    title={`${badgeCount} componente(s) em baixa`}
                    style={{
                      background: '#B42318',
                      color: 'white',
                      fontSize: '11px',
                      fontWeight: 700,
                      borderRadius: '999px',
                      padding: '2px 7px',
                      lineHeight: 1.4,
                      minWidth: '18px',
                      textAlign: 'center',
                    }}
                  >
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div style={{ marginTop: 'auto', padding: '24px' }}>
          <Link href="/" style={{ color: 'rgba(240,245,251,0.72)', fontSize: '14px' }}>
            Voltar para a loja
          </Link>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, padding: '32px', backgroundColor: '#F0F5FB' }}>
        <div style={{ width: '100%', maxWidth: '1240px', margin: '0 auto' }}>
          {children}
        </div>
      </main>
    </div>
  )
}
