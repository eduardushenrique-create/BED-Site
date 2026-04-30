'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useCart } from '@/context/CartContext'

const navLinks = [
  { href: '/', label: 'Início' },
  { href: '/produtos', label: 'Produtos' },
  { href: '/personalizados', label: 'Personalizados' },
  { href: '/presentes', label: 'Presentes' },
  { href: '/sobre', label: 'Sobre' },
  { href: '/contato', label: 'Contato' },
]

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { itemCount, setIsOpen } = useCart()

  return (
    <header style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: 'white',
      borderBottom: '1px solid #E8E2DA',
      zIndex: 100,
    }}>
      <div className="container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '64px',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center' }}>
          <Image 
            src="/logo.svg" 
            alt="Forma 3D" 
            width={140} 
            height={32}
            style={{ height: 'auto' }}
          />
        </Link>

        <nav style={{ display: 'none', gap: '24px' }} className="desktop-nav">
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                fontSize: '16px',
                fontWeight: 500,
                color: '#1C1917',
                transition: 'color var(--transition-fast)',
              }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
          }} aria-label="Buscar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1C1917" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
          </button>
          
          <button
            onClick={() => setIsOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              position: 'relative',
            }}
            aria-label="Carrinho"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1C1917" strokeWidth="1.5">
              <path d="M6 6h15l-1.5 9h-12z"/>
              <circle cx="9" cy="20" r="1"/>
              <circle cx="18" cy="20" r="1"/>
              <path d="M6 6L5 3H2"/>
            </svg>
            {itemCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '2px',
                right: '2px',
                backgroundColor: '#C8552A',
                color: 'white',
                fontSize: '10px',
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: '999px',
              }}>{itemCount}</span>
            )}
          </button>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              display: 'none',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
            }}
            className="mobile-menu-btn"
            aria-label="Menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1C1917" strokeWidth="1.5">
              {menuOpen ? (
                <path d="M6 6l12 12M6 18L18 6"/>
              ) : (
                <path d="M3 12h18M3 6h18M3 18h18"/>
              )}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '16px 24px',
          backgroundColor: 'white',
          borderTop: '1px solid #E8E2DA',
        }}>
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                padding: '12px 0',
                fontSize: '16px',
                fontWeight: 500,
                color: '#1C1917',
                borderBottom: '1px solid #E8E2DA',
              }}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}

      <style>{`
        @media (min-width: 768px) {
          .desktop-nav { display: flex !important; }
          .mobile-menu-btn { display: none !important; }
        }
        @media (max-width: 767px) {
          .mobile-menu-btn { display: block !important; }
        }
      `}</style>
    </header>
  )
}