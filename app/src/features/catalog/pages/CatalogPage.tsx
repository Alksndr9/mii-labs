import { useState } from 'react'
import type { DietDuration } from '../../../shared/types/diet'
import { useAsync } from '../../../shared/lib/useAsync'
import { EmptyState, ErrorState, LoadingState } from '../../../shared/ui/StatusViews'
import { useCart } from '../../cart/cartContextValue'
import { fetchMeals } from '../api/mealsApi'
import { MealCard } from '../components/MealCard'
import { GOAL_LABELS, type Meal, type MealGoal } from '../types'

const FILTERS: (MealGoal | 'all')[] = ['all', 'balance', 'weight-loss', 'sport', 'vegetarian']

export function CatalogPage() {
  const meals = useAsync(fetchMeals)
  const { addItem } = useCart()
  const [goal, setGoal] = useState<MealGoal | 'all'>('all')

  return (
    <>
      <section className="py-6 sm:py-10">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-5xl">Еда на неделю — без забот</h1>
        <p className="mt-3 text-stone-500 sm:text-lg">Готовые рационы с доставкой. Выберите цель и срок — чем дольше, тем выгоднее.</p>
        <div className="mt-6 flex gap-2 overflow-x-auto pb-1" aria-label="Фильтр по цели">
          {FILTERS.map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={goal === g}
              onClick={() => setGoal(g)}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-sm transition ${
                goal === g ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 text-stone-600 hover:border-stone-400'
              }`}
            >
              {g === 'all' ? 'Все' : GOAL_LABELS[g]}
            </button>
          ))}
        </div>
      </section>

      {meals.status === 'loading' && <LoadingState label="Загружаем рационы…" />}
      {meals.status === 'error' && <ErrorState message={meals.error.message} onRetry={meals.retry} />}
      {meals.status === 'success' && (
        <MealGrid meals={meals.data.filter((m) => goal === 'all' || m.goal === goal)} onAdd={(meal, days) =>
          addItem({ dietId: meal.id, title: meal.title, imageUrl: meal.imageUrl, pricePerDay: meal.pricePerDay, days })
        } />
      )}
    </>
  )
}

interface MealGridProps {
  meals: Meal[]
  onAdd: (meal: Meal, days: DietDuration) => void
}

function MealGrid({ meals, onAdd }: MealGridProps) {
  if (meals.length === 0) return <EmptyState title="Рационов с такой целью пока нет">Попробуйте выбрать другую цель.</EmptyState>
  return (
    <div className="grid gap-6 pb-12 sm:grid-cols-2 lg:grid-cols-3">
      {meals.map((meal) => (
        <MealCard key={meal.id} meal={meal} onAddToCart={onAdd} />
      ))}
    </div>
  )
}
