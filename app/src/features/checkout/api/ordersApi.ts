import { supabase } from '../../../shared/api/supabase'
import type { CartLine } from '../../cart/cartContextValue'
import type { OrderTotal } from '../../cart/types'
import type { DeliveryAddress } from '../types'

export interface CreateOrderInput {
  address: DeliveryAddress
  deliveryDate: string
  lines: readonly CartLine[]
  total: OrderTotal
}

export async function createOrder(input: CreateOrderInput): Promise<string> {
  if (!supabase) {
    await new Promise((resolve) => setTimeout(resolve, 600))
    return `MOCK-${Date.now().toString(36).toUpperCase()}`
  }
  const { data, error } = await supabase
    .from('orders')
    .insert({
      street: input.address.street,
      house: input.address.house,
      apartment: input.address.apartment,
      phone: input.address.phone,
      delivery_date: input.deliveryDate,
      items: input.lines.map(({ dietId, days, quantity }) => ({ diet_id: dietId, days, quantity })),
      total: input.total.total,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.code === '42501' ? 'Войдите в аккаунт, чтобы оформить заказ.' : 'Не удалось оформить заказ. Попробуйте ещё раз.')
  return String(data.id)
}
