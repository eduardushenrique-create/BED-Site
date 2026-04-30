'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/admin/pedidos', label: 'Pedidos' },
  { href: '/admin/clientes', label: 'Clientes' },
  { href: '/admin/produtos', label: 'Produtos' },
  { href: '/admin/categorias', label: 'Categorias' },
  { href: '/admin/banners', label: 'Banners' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#F5F2EE' }}>
      <aside style={{
        width: '240px',
        backgroundColor: '#1C1917',
        color: 'white',
        padding: '24px 0',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        position: 'sticky',
        top: 0,
      }}>
        <div style={{ padding: '0 24px', marginBottom: '32px' }}>
          <Link href="/" style={{ fontSize: '20px', fontWeight: 700, color: '#C8552A' }}>
            Forma 3D
          </Link>
          <span style={{ fontSize: '12px', color: '#A8A29E', display: 'block', marginTop: '4px' }}>
            Admin
          </span>
        </div>

        <nav>
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'block',
                padding: '12px 24px',
                color: pathname.startsWith(item.href) ? 'white' : '#A8A29E',
                backgroundColor: pathname.startsWith(item.href) ? '#333' : 'transparent',
                borderLeft: pathname.startsWith(item.href) ? '3px solid #C8552A' : '3px solid transparent',
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div style={{ marginTop: 'auto', padding: '24px' }}>
          <Link href="/" style={{ color: '#A8A29E', fontSize: '14px' }}>
            ← Voltar para loja
          </Link>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, padding: '32px', backgroundColor: '#F5F2EE' }}>
        <div style={{ width: '100%', maxWidth: '1240px', margin: '0 auto' }}>
          {children}
        </div>
      </main>
    </div>
  )
}
