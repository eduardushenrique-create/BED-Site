'use client'

import { usePathname } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { CartProvider } from '@/context/CartContext'
import { AuthProvider } from '@/context/AuthContext'
import { WishlistProvider } from '@/context/WishlistContext'
import CartDrawer from '@/components/CartDrawer'

export default function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAdmin = pathname.startsWith('/admin')

  return (
    <AuthProvider>
      <WishlistProvider>
        <CartProvider>
          {!isAdmin && <Header />}
          {children}
          {!isAdmin && <Footer />}
          {!isAdmin && <CartDrawer />}
        </CartProvider>
      </WishlistProvider>
    </AuthProvider>
  )
}
