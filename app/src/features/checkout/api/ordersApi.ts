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
  promoCode: string | null
}

export async function createOrder(input: CreateOrderInput): Promise<string> {
  if (!supabase) {
    await new Promise((resolve) => setTimeout(resolve, 600))
    return `MOCK-${Date.now().toString(36).toUpperCase()}`
  }
  // Сумму считает сервер (RPC create_order) по ценам из БД — клиентскому total не доверяем (F-01 аудита)
  const { data, error, status } = await supabase.rpc('create_order', {
    p_street: input.address.street,
    p_house: input.address.house,
    p_apartment: input.address.apartment ?? '',
    p_phone: input.address.phone,
    p_delivery_date: input.deliveryDate,
    p_items: input.lines.map(({ dietId, days, quantity }) => ({ diet_id: dietId, days, quantity })),
    p_promo_code: input.promoCode,
  })
  if (error) throw toApiError(error, status, 'createOrder')
  logger.info('order_created', { orderId: data, clientTotal: input.total.total, items: input.lines.length })
  return String(data)
}
