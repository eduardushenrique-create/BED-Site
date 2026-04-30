'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface CartItem {
  productId: string
  productName: string
  productImage: string | null
  variantId: string | null
  variantName: string | null
  quantity: number
  unitPrice: number
  personalization: Record<string, string> | null
}

interface CartContextType {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void
  removeItem: (productId: string, variantId: string | null) => void
  updateQuantity: (productId: string, variantId: string | null, quantity: number) => void
  clearCart: () => void
  itemCount: number
  subtotal: number
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('cart')
    if (saved) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setItems(JSON.parse(saved))
      } catch {
        console.error('Failed to parse cart from localStorage')
      }
    }
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem('cart', JSON.stringify(items))
    }
  }, [items, isHydrated])

  const addItem = (newItem: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
    setItems(current => {
      const existingIndex = current.findIndex(
        item => item.productId === newItem.productId && item.variantId === newItem.variantId
      )

      if (existingIndex >= 0) {
        const updated = [...current]
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + (newItem.quantity || 1),
        }
        return updated
      }

      return [...current, { ...newItem, quantity: newItem.quantity || 1 }]
    })
    setIsOpen(true)
  }

  const removeItem = (productId: string, variantId: string | null) => {
    setItems(current => current.filter(
      item => !(item.productId === productId && item.variantId === variantId)
    ))
  }

  const updateQuantity = (productId: string, variantId: string | null, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId, variantId)
      return
    }

    setItems(current => current.map(item => {
      if (item.productId === productId && item.variantId === variantId) {
        return { ...item, quantity }
      }
      return item
    }))
  }

  const clearCart = () => {
    setItems([])
  }

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0)

  return (
    <CartContext.Provider value={{
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      itemCount,
      subtotal,
      isOpen,
      setIsOpen,
    }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}