import { toApiError } from '../../../shared/api/apiError'
import { supabase } from '../../../shared/api/supabase'
import { logger } from '../../../shared/lib/logger'
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
  // user_id и статус подставляет БД (default auth.uid()), RLS не даст создать заказ за другого пользователя
  const { data, error, status } = await supabase
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
  if (error) throw toApiError(error, status, 'createOrder')
  logger.info('order_created', { orderId: data.id, total: input.total.total, items: input.lines.length })
  return String(data.id)
}
