'use client'

import { usePathname } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { CartProvider } from '@/context/CartContext'
import CartDrawer from '@/components/CartDrawer'

export default function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAdmin = pathname.startsWith('/admin')

  return (
    <CartProvider>
      {!isAdmin && <Header />}
      {children}
      {!isAdmin && <Footer />}
      {!isAdmin && <CartDrawer />}
    </CartProvider>
  )
}
