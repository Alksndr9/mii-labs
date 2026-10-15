import { createContext, useContext } from 'react'
import type { DietDuration } from '../../shared/types/diet'
import type { CartItem, OrderTotal } from './types'

export interface CartLine extends CartItem {
  readonly title: string
  readonly imageUrl: string
}

export interface CartContextValue {
  lines: readonly CartLine[]
  itemCount: number
  total: OrderTotal
  promoCode: string | null
  addItem: (line: Omit<CartLine, 'quantity'>) => void
  setQuantity: (dietId: string, days: DietDuration, quantity: number) => void
  applyPromo: (code: string) => boolean
  clearPromo: () => void
  clear: () => void
}

export const CartContext = createContext<CartContextValue | null>(null)

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart должен использоваться внутри CartProvider')
  return ctx
}
