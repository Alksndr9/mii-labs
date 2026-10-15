import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatRub } from '../../../shared/lib/formatMoney'
import { MealImage } from '../../../shared/ui/MealImage'
import type { DietDuration } from '../../../shared/types/diet'
import { calculateOrderTotal } from '../../cart/lib/calculateOrderTotal'
import { GOAL_LABELS, type Meal } from '../types'
import { DurationPicker } from './DurationPicker'

const ADDED_FEEDBACK_MS = 1000

interface MealCardProps {
  meal: Meal
  onAddToCart: (meal: Meal, days: DietDuration) => void
}

export function MealCard({ meal, onAddToCart }: MealCardProps) {
  const [days, setDays] = useState<DietDuration>(1)
  const [justAdded, setJustAdded] = useState(false)

  useEffect(() => {
    if (!justAdded) return
    const timer = setTimeout(() => setJustAdded(false), ADDED_FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [justAdded])

  // Цена со скидкой за срок считается той же функцией, что и в корзине, — без расхождений
  const price = calculateOrderTotal([{ dietId: meal.id, pricePerDay: meal.pricePerDay, days, quantity: 1 }]).lines[0].total

  return (
    <article className="relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-100 transition hover:shadow-md">
      {meal.isHit && (
        <span className="absolute left-3 top-3 z-10 rounded-full bg-orange-500 px-3 py-1 text-xs font-bold uppercase text-white">Хит</span>
      )}
      <Link to={`/meals/${meal.id}`} className="block">
        <MealImage src={meal.imageUrl} alt={meal.title} className="aspect-[4/3] w-full" />
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-stone-400">{GOAL_LABELS[meal.goal]}</p>
          <h2 className="text-lg font-semibold text-stone-900">
            <Link to={`/meals/${meal.id}`} className="hover:underline">{meal.title}</Link>
          </h2>
          <p className="text-sm text-stone-500">
            {meal.calories} ккал · {meal.mealsPerDay} приёмов пищи
          </p>
        </div>
        <DurationPicker value={days} onChange={setDays} />
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
          <div>
            <p className="text-xl font-bold text-stone-900">{formatRub(price)}</p>
            {days > 1 && <p className="text-xs text-stone-500">{formatRub(meal.pricePerDay)} / день без скидки</p>}
          </div>
          <button
            type="button"
            disabled={justAdded}
            onClick={() => {
              onAddToCart(meal, days)
              setJustAdded(true)
            }}
            className={`min-w-32 rounded-full px-4 py-2 text-sm font-medium text-white transition active:scale-95 ${
              justAdded ? 'bg-green-800' : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {justAdded ? 'Добавлено ✓' : 'В корзину'}
          </button>
        </div>
      </div>
    </article>
  )
}
