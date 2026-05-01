'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useCart } from '@/context/CartContext'
import { useAuth } from '@/context/AuthContext'
import BrandLogo from '@/components/BrandLogo'
import SearchOverlay from '@/components/SearchOverlay'

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
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const userMenuRef = useRef<HTMLDivElement | null>(null)
  const { itemCount, setIsOpen } = useCart()
  const { user, loading, logout } = useAuth()

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) {
      window.addEventListener('keydown', handleKeyDown)
      window.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuOpen])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setUserMenuOpen(false)
    }
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    if (userMenuOpen) {
      window.addEventListener('keydown', handleKeyDown)
      window.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('mousedown', handleClickOutside)
    }
  }, [userMenuOpen])

  function getInitials(name: string) {
    const parts = name.trim().split(/\s+/)
    return parts.length === 1
      ? parts[0].charAt(0).toUpperCase()
      : (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
  }

  return (
    <header
      ref={menuRef}
      style={{
        position: 'sticky',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(255,255,255,0.96)',
        borderBottom: '1px solid #D8DCE8',
        zIndex: 100,
        backdropFilter: 'blur(14px)',
      }}
    >
      <div
        className="container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px',
          minHeight: '68px',
        }}
      >
        <BrandLogo size="md" />

        <nav style={{ display: 'none', gap: '6px', alignItems: 'center' }} className="desktop-nav">
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                fontSize: '14px',
                fontWeight: 500,
                color: '#3D4460',
                transition: 'background-color var(--transition-fast), color var(--transition-fast)',
                padding: '8px 12px',
                borderRadius: '8px',
              }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setSearchOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              color: '#3D4460',
              borderRadius: '8px',
            }}
            aria-label="Buscar"
            aria-expanded={searchOpen}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
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
              color: '#3D4460',
              borderRadius: '8px',
            }}
            aria-label="Carrinho"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M6 6h15l-1.5 9h-12z" />
              <circle cx="9" cy="20" r="1" />
              <circle cx="18" cy="20" r="1" />
              <path d="M6 6L5 3H2" />
            </svg>
            {itemCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  backgroundColor: '#D4849A',
                  color: 'white',
                  fontSize: '10px',
                  fontWeight: 700,
                  minWidth: '18px',
                  height: '18px',
                  borderRadius: '999px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {itemCount}
              </span>
            )}
          </button>

          {!loading && (user ? (
            <div ref={userMenuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setUserMenuOpen(prev => !prev)}
                aria-label="Menu da conta"
                aria-expanded={userMenuOpen}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#F0F5FB',
                  border: '1px solid #D8DCE8',
                  cursor: 'pointer',
                  padding: '6px 12px 6px 6px',
                  borderRadius: '999px',
                  color: '#1D2235',
                  fontWeight: 600,
                  fontSize: '14px',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: '#1D2235',
                    color: '#F0F5FB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  {getInitials(user.name || user.email)}
                </span>
                <span className="user-menu-name">{user.name?.split(' ')[0] || 'Conta'}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {userMenuOpen && (
                <div
                  role="menu"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    minWidth: '220px',
                    background: 'white',
                    borderRadius: '12px',
                    border: '1px solid #E3E9F4',
                    boxShadow: '0 12px 30px rgba(29,34,53,0.12)',
                    padding: '8px',
                    zIndex: 200,
                  }}
                >
                  <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid #EEF1F8', marginBottom: '6px' }}>
                    <div style={{ fontSize: '13px', color: '#6B7494' }}>Olá,</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1D2235', wordBreak: 'break-word' }}>{user.name || user.email}</div>
                  </div>
                  <Link href="/minha-conta" onClick={() => setUserMenuOpen(false)} style={dropdownItemStyle}>Minha conta</Link>
                  <Link href="/meus-pedidos" onClick={() => setUserMenuOpen(false)} style={dropdownItemStyle}>Meus pedidos</Link>
                  <Link href="/minha-conta/enderecos" onClick={() => setUserMenuOpen(false)} style={dropdownItemStyle}>Endereços salvos</Link>
                  {(user.role && user.role !== 'customer') && (
                    <Link href="/admin" onClick={() => setUserMenuOpen(false)} style={dropdownItemStyle}>Painel admin</Link>
                  )}
                  <button
                    onClick={() => { setUserMenuOpen(false); logout() }}
                    style={{ ...dropdownItemStyle, width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: '#A3526A' }}
                  >
                    Sair
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #1D2235',
                background: 'white',
                color: '#1D2235',
                fontWeight: 600,
                fontSize: '14px',
                textDecoration: 'none',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Entrar
            </Link>
          ))}

          <button
            onClick={() => setMenuOpen(value => !value)}
            style={{
              display: 'none',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              color: '#3D4460',
              borderRadius: '8px',
            }}
            className="mobile-menu-btn"
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={menuOpen}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              {menuOpen ? <path d="M6 6l12 12M6 18L18 6" /> : <path d="M3 12h18M3 6h18M3 18h18" />}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '12px 24px 20px',
            backgroundColor: 'white',
            borderTop: '1px solid #EEF1F8',
          }}
        >
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                padding: '14px 0',
                fontSize: '15px',
                fontWeight: 500,
                color: '#1D2235',
                borderBottom: '1px solid #EEF1F8',
              }}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}

      <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      <style>{`
        @media (min-width: 768px) {
          .desktop-nav { display: flex !important; }
          .mobile-menu-btn { display: none !important; }
        }
        @media (max-width: 767px) {
          .mobile-menu-btn { display: block !important; }
          .user-menu-name { display: none; }
        }
        .desktop-nav a:hover {
          background: #F0F5FB;
          color: #1D2235;
        }
      `}</style>
    </header>
  )
}

const dropdownItemStyle: React.CSSProperties = {
  display: 'block',
  padding: '10px 12px',
  fontSize: '14px',
  color: '#1D2235',
  textDecoration: 'none',
  borderRadius: '8px',
  fontWeight: 500,
}
