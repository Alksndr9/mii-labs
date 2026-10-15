import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { formatRub } from '../../../shared/lib/formatMoney'
import { useAsync } from '../../../shared/lib/useAsync'
import type { DietDuration } from '../../../shared/types/diet'
import { MealImage } from '../../../shared/ui/MealImage'
import { EmptyState, ErrorState, LoadingState } from '../../../shared/ui/StatusViews'
import { useCart } from '../../cart/cartContextValue'
import { calculateOrderTotal } from '../../cart/lib/calculateOrderTotal'
import { fetchMealById } from '../api/mealsApi'
import { DurationPicker } from '../components/DurationPicker'
import { GOAL_LABELS } from '../types'

export function MealPage() {
  const { id = '' } = useParams()
  const meal = useAsync(useCallback(() => fetchMealById(id), [id]))
  const { addItem } = useCart()
  const [days, setDays] = useState<DietDuration>(5)
  const [added, setAdded] = useState(false)

  if (meal.status === 'loading') return <LoadingState label="Загружаем рацион…" />
  if (meal.status === 'error') return <ErrorState message={meal.error.message} onRetry={meal.retry} />
  if (!meal.data)
    return (
      <EmptyState title="Рацион не найден">
        <Link to="/" className="text-green-700 underline">Вернуться в каталог</Link>
      </EmptyState>
    )

  const m = meal.data
  const price = calculateOrderTotal([{ dietId: m.id, pricePerDay: m.pricePerDay, days, quantity: 1 }]).lines[0].total

  return (
    <div className="grid gap-8 py-6 md:grid-cols-2">
      <MealImage src={m.imageUrl} alt={m.title} className="aspect-[4/3] w-full rounded-2xl" />
      <div className="flex flex-col gap-4">
        <Link to="/" className="text-sm text-stone-500 hover:underline">← Все рационы</Link>
        <p className="text-xs uppercase tracking-wide text-stone-400">{GOAL_LABELS[m.goal]}</p>
        <h1 className="text-3xl font-semibold text-stone-900">{m.title}</h1>
        <p className="text-stone-600">{m.description}</p>
        <p className="text-sm text-stone-500">{m.calories} ккал · {m.mealsPerDay} приёмов пищи в день</p>
        <div>
          <h2 className="mb-2 font-medium">Меню на день</h2>
          <ol className="list-decimal space-y-1 pl-5 text-stone-600">
            {m.menu.map((dish) => <li key={dish}>{dish}</li>)}
          </ol>
        </div>
        <DurationPicker value={days} onChange={setDays} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-2xl font-bold">{formatRub(price)}</p>
          <button
            type="button"
            onClick={() => {
              addItem({ dietId: m.id, title: m.title, imageUrl: m.imageUrl, pricePerDay: m.pricePerDay, days })
              setAdded(true)
            }}
            className="rounded-full bg-green-600 px-6 py-3 font-medium text-white hover:bg-green-700"
          >
            В корзину
          </button>
        </div>
        {added && (
          <p role="status" className="text-sm text-green-700">
            Добавлено в корзину. <Link to="/cart" className="underline">Перейти в корзину</Link>
          </p>
        )}
      </div>
    </div>
  )
}
