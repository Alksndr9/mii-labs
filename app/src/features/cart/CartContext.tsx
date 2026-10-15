import { useCallback, useEffect, useMemo, useState } from 'react'
import { isDietDuration, type DietDuration } from '../../shared/types/diet'
import { calculateOrderTotal } from './lib/calculateOrderTotal'
import { trackGoal } from '../../shared/lib/analytics'
import { findPromo } from './promoCodes'
import { CartContext, type CartContextValue, type CartLine } from './cartContextValue'
import type { Promo } from './types'

const STORAGE_KEY = 'zelen-cart-v1'

function isCartLine(value: unknown): value is CartLine {
  if (typeof value !== 'object' || value === null) return false
  const v: Record<string, unknown> = { ...value }
  return (
    typeof v.dietId === 'string' &&
    typeof v.title === 'string' &&
    typeof v.imageUrl === 'string' &&
    Number.isInteger(v.pricePerDay) &&
    Number.isInteger(v.quantity) &&
    isDietDuration(v.days)
  )
}

// Данные из localStorage могут быть повреждены или устареть — берём только валидные строки
function loadLines(): CartLine[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(isCartLine) : []
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(loadLines)
  const [promo, setPromo] = useState<{ code: string; promo: Promo } | null>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
  }, [lines])

  const addItem = useCallback((line: Omit<CartLine, 'quantity'>) => {
    trackGoal('add_to_cart', { dietId: line.dietId, days: line.days })
    setLines((prev) => {
      const existing = prev.find((l) => l.dietId === line.dietId && l.days === line.days)
      if (!existing) return [...prev, { ...line, quantity: 1 }]
      return prev.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l))
    })
  }, [])

  const setQuantity = useCallback((dietId: string, days: DietDuration, quantity: number) => {
    setLines((prev) =>
      quantity <= 0
        ? prev.filter((l) => !(l.dietId === dietId && l.days === days))
        : prev.map((l) => (l.dietId === dietId && l.days === days ? { ...l, quantity } : l)),
    )
  }, [])

  const applyPromo = useCallback((code: string) => {
    const found = findPromo(code)
    if (found) {
      setPromo({ code: code.trim().toUpperCase(), promo: found })
      trackGoal('promo_applied', { code: code.trim().toUpperCase() })
    }
    return found !== null
  }, [])

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
      total: calculateOrderTotal(lines, promo?.promo),
      promoCode: promo?.code ?? null,
      addItem,
      setQuantity,
      applyPromo,
      clearPromo: () => setPromo(null),
      clear: () => {
        setLines([])
        setPromo(null)
      },
    }),
    [lines, promo, addItem, setQuantity, applyPromo],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
