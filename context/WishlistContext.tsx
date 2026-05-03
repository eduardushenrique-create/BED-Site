'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'

type WishlistContextValue = {
  productIds: Set<string>
  loading: boolean
  isFavorite: (productId: string) => boolean
  add: (productId: string) => Promise<boolean>
  remove: (productId: string) => Promise<boolean>
  toggle: (productId: string) => Promise<boolean | null>
  refresh: () => Promise<void>
}

const WishlistContext = createContext<WishlistContextValue | null>(null)

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [productIds, setProductIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    // Aceita qualquer usuário logado (incluindo admin) — bloquear por
    // role causava redirect ao clicar no coração.
    if (!user) {
      setProductIds(new Set())
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/me/wishlist', { cache: 'no-store' })
      if (!res.ok) {
        setProductIds(new Set())
        return
      }
      const items: Array<{ productId: string }> = await res.json()
      setProductIds(new Set(Array.isArray(items) ? items.map(i => i.productId) : []))
    } catch {
      setProductIds(new Set())
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  const isFavorite = useCallback((productId: string) => productIds.has(productId), [productIds])

  const add = useCallback(async (productId: string) => {
    setProductIds(prev => {
      const next = new Set(prev)
      next.add(productId)
      return next
    })
    try {
      const res = await fetch('/api/me/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      })
      if (!res.ok) {
        setProductIds(prev => {
          const next = new Set(prev)
          next.delete(productId)
          return next
        })
        return false
      }
      return true
    } catch {
      setProductIds(prev => {
        const next = new Set(prev)
        next.delete(productId)
        return next
      })
      return false
    }
  }, [])

  const remove = useCallback(async (productId: string) => {
    setProductIds(prev => {
      const next = new Set(prev)
      next.delete(productId)
      return next
    })
    try {
      const res = await fetch(`/api/me/wishlist/${encodeURIComponent(productId)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        setProductIds(prev => {
          const next = new Set(prev)
          next.add(productId)
          return next
        })
        return false
      }
      return true
    } catch {
      setProductIds(prev => {
        const next = new Set(prev)
        next.add(productId)
        return next
      })
      return false
    }
  }, [])

  const toggle = useCallback(async (productId: string): Promise<boolean | null> => {
    if (!user) return null
    if (productIds.has(productId)) {
      const ok = await remove(productId)
      return ok ? false : null
    }
    const ok = await add(productId)
    return ok ? true : null
  }, [user, productIds, add, remove])

  const value = useMemo(
    () => ({ productIds, loading, isFavorite, add, remove, toggle, refresh }),
    [productIds, loading, isFavorite, add, remove, toggle, refresh],
  )

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
}

export function useWishlist() {
  const ctx = useContext(WishlistContext)
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider')
  return ctx
}
