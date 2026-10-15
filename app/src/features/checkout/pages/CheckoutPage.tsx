import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../../../shared/ui/StatusViews'
import { useCart } from '../../cart/cartContextValue'
import { OrderSummary } from '../../cart/components/OrderSummary'
import { trackGoal } from '../../../shared/lib/analytics'
import { createOrder } from '../api/ordersApi'
import { AddressForm } from '../components/AddressForm'

// Минимальный срок производства — доставка не ранее чем через 2 дня
function earliestDeliveryDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 2)
  return d.toISOString().slice(0, 10)
}

export function CheckoutPage() {
  const { lines, total, clear } = useCart()
  const [deliveryDate, setDeliveryDate] = useState(earliestDeliveryDate)
  const [orderId, setOrderId] = useState<string | null>(null)

  useEffect(() => {
    trackGoal('begin_checkout')
  }, [])

  if (orderId)
    return (
      <EmptyState title={`Заказ ${orderId} оформлен!`}>
        Мы пришлём SMS за час до доставки. <Link to="/" className="text-green-700 underline">На главную</Link>
      </EmptyState>
    )
  if (lines.length === 0)
    return (
      <EmptyState title="Нечего оформлять — корзина пуста">
        <Link to="/" className="text-green-700 underline">Выбрать рацион</Link>
      </EmptyState>
    )

  return (
    <div className="grid gap-8 py-6 lg:grid-cols-[1fr_340px]">
      <section className="space-y-6">
        <h1 className="text-2xl font-semibold">Оформление заказа</h1>
        <div>
          <label htmlFor="delivery-date" className="block text-sm font-medium">Дата первой доставки</label>
          <input id="delivery-date" type="date" min={earliestDeliveryDate()} value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="mt-1 rounded-lg border border-stone-300 px-3 py-2" />
        </div>
        <AddressForm
          onSubmit={async (address) => {
            const id = await createOrder({ address, deliveryDate, lines, total })
            trackGoal('order_created', { total: total.total })
            clear()
            setOrderId(id)
          }}
        />
      </section>
      <aside className="h-fit rounded-2xl bg-white p-5 ring-1 ring-stone-100">
        <h2 className="mb-3 font-medium">Ваш заказ</h2>
        <OrderSummary total={total} />
      </aside>
    </div>
  )
}
