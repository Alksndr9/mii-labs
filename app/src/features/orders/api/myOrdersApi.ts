import { toApiError } from '../../../shared/api/apiError'
import { supabase } from '../../../shared/api/supabase'
import type { Kopecks } from '../../../shared/types/money'

export type OrderStatus = 'pending_payment' | 'paid' | 'delivering' | 'completed' | 'cancelled'

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: 'Ожидает оплаты',
  paid: 'Оплачен',
  delivering: 'В доставке',
  completed: 'Выполнен',
  cancelled: 'Отменён',
}

export interface MyOrder {
  id: number
  status: OrderStatus
  delivery_date: string
  street: string
  house: string
  total: Kopecks
  created_at: string
}

export async function fetchMyOrders(): Promise<MyOrder[]> {
  if (!supabase) return []
  const { data, error, status } = await supabase
    .from('orders')
    .select('id, status, delivery_date, street, house, total, created_at')
    .order('created_at', { ascending: false })
    .returns<MyOrder[]>()
  if (error) throw toApiError(error, status, 'fetchMyOrders')
  return data
}

export async function cancelOrder(id: number): Promise<void> {
  if (!supabase) return
  const { error, status } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', id)
  if (error) throw toApiError(error, status, 'cancelOrder')
}
