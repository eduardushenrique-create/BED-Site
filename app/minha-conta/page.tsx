'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useWishlist } from '@/context/WishlistContext'

export default function MinhaContaPage() {
  const router = useRouter()
  const { user, loading: authLoading, logout } = useAuth()
  const { productIds: wishlistIds } = useWishlist()
  const [orderCount, setOrderCount] = useState<number | null>(null)
  const [addressCount, setAddressCount] = useState<number | null>(null)
  const wishlistCount = wishlistIds.size

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login?redirect=/minha-conta')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (!user) return
    Promise.all([
      fetch('/api/me/orders?limit=1', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
      fetch('/api/me/addresses', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
    ]).then(([ordersData, addressesData]) => {
      setOrderCount(ordersData?.total ?? 0)
      setAddressCount(Array.isArray(addressesData) ? addressesData.length : 0)
    })
  }, [user])

  if (authLoading || !user) {
    return <main className="container" style={{ paddingTop: '112px', textAlign: 'center', color: '#6B7494' }}>Carregando...</main>
  }

  return (
    <main className="container" style={{ paddingTop: '112px', paddingBottom: '64px', maxWidth: '960px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <p style={{ fontSize: '13px', color: '#4A7AB5', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0 }}>Minha conta</p>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 40px)', color: '#1D2235', margin: '8px 0 4px' }}>Olá, {user.name?.split(' ')[0] || 'cliente'}</h1>
          <p style={{ color: '#6B7494', margin: 0 }}>{user.email}</p>
        </div>
        <button onClick={logout} style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid #D8DCE8', background: 'white', color: '#A3526A', cursor: 'pointer', fontWeight: 600 }}>
          Sair
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
        <Card href="/meus-pedidos" title="Pedidos" subtitle={orderCount === null ? 'carregando...' : `${orderCount} ${orderCount === 1 ? 'pedido' : 'pedidos'}`} cta="Ver pedidos" icon={<IconBox />} />
        <Card href="/minha-conta/favoritos" title="Favoritos" subtitle={`${wishlistCount} ${wishlistCount === 1 ? 'produto salvo' : 'produtos salvos'}`} cta="Ver favoritos" icon={<IconHeart />} />
        <Card href="/minha-conta/dados" title="Dados pessoais" subtitle="Nome, telefone, CPF" cta="Editar dados" icon={<IconUser />} />
        <Card href="/minha-conta/enderecos" title="Endereços salvos" subtitle={addressCount === null ? 'carregando...' : `${addressCount} ${addressCount === 1 ? 'endereço' : 'endereços'}`} cta="Gerenciar" icon={<IconPin />} />
        <Card href="/minha-conta/privacidade" title="Privacidade (LGPD)" subtitle="Baixe seus dados ou exclua a conta" cta="Acessar" icon={<IconShield />} />
      </div>
    </main>
  )
}

function Card({ href, title, subtitle, cta, icon }: { href: string; title: string; subtitle: string; cta: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '24px',
        background: 'white',
        borderRadius: '14px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        textDecoration: 'none',
        color: '#1D2235',
        minHeight: '180px',
      }}
    >
      <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#F0F5FB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <h2 style={{ fontSize: '18px', margin: 0 }}>{title}</h2>
      <p style={{ color: '#6B7494', margin: 0, flex: 1 }}>{subtitle}</p>
      <span style={{ fontWeight: 600, color: '#4A7AB5' }}>{cta} →</span>
    </Link>
  )
}

function IconBox() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1D2235" strokeWidth="1.7"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> }
function IconUser() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1D2235" strokeWidth="1.7"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> }
function IconPin() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1D2235" strokeWidth="1.7"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg> }
function IconHeart() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D4849A" strokeWidth="1.7"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> }
function IconShield() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1D2235" strokeWidth="1.7"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> }
