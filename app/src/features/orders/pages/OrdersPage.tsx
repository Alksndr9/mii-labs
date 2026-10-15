import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatRub } from '../../../shared/lib/formatMoney'
import { useAsync } from '../../../shared/lib/useAsync'
import { EmptyState, ErrorState, LoadingState } from '../../../shared/ui/StatusViews'
import { cancelOrder, fetchMyOrders, STATUS_LABELS } from '../api/myOrdersApi'

export function OrdersPage() {
  const orders = useAsync(fetchMyOrders)
  const [actionError, setActionError] = useState<string | null>(null)

  if (orders.status === 'loading') return <LoadingState label="Загружаем заказы…" />
  if (orders.status === 'error') return <ErrorState message={orders.error.message} onRetry={orders.retry} />
  if (orders.data.length === 0)
    return (
      <EmptyState title="Заказов пока нет">
        <Link to="/" className="text-green-700 underline">Выбрать рацион</Link>
      </EmptyState>
    )

  return (
    <div className="py-6">
      <h1 className="mb-4 text-2xl font-semibold">Мои заказы</h1>
      {actionError && <p role="alert" className="mb-3 text-sm text-red-700">{actionError}</p>}
      <ul className="divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-100">
        {orders.data.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-medium">Заказ №{o.id} · {formatRub(o.total)}</p>
              <p className="text-sm text-stone-500">
                Доставка с {new Date(o.delivery_date).toLocaleDateString('ru-RU')} · {o.street}, {o.house}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-stone-100 px-3 py-1 text-sm">{STATUS_LABELS[o.status]}</span>
              {o.status === 'pending_payment' && (
                <button
                  type="button"
                  onClick={() =>
                    cancelOrder(o.id).then(orders.retry, (err: unknown) => setActionError(err instanceof Error ? err.message : 'Ошибка отмены'))
                  }
                  className="text-sm text-red-700 underline"
                >
                  Отменить
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
