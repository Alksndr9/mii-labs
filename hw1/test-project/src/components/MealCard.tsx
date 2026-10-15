import { useEffect, useState } from 'react'

const DURATIONS = [1, 5, 7] as const
type Duration = (typeof DURATIONS)[number]

const ADDED_FEEDBACK_MS = 1000

interface MealCardProps {
  title: string
  calories: number
  /** Цена за один день, ₽ */
  price: number
  imageUrl: string
  isHit?: boolean
  onAddToCart: (days: Duration) => void
}

const priceFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
})

export function MealCard({ title, calories, price, imageUrl, isHit = false, onAddToCart }: MealCardProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const [days, setDays] = useState<Duration>(1)
  const [justAdded, setJustAdded] = useState(false)

  useEffect(() => {
    if (!justAdded) return
    const timer = setTimeout(() => setJustAdded(false), ADDED_FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [justAdded])

  const handleAdd = () => {
    onAddToCart(days)
    setJustAdded(true)
  }

  return (
    <article className="relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-md transition hover:shadow-lg">
      {isHit && (
        <span className="absolute left-3 top-3 z-10 rounded-full bg-orange-500 px-3 py-1 text-xs font-bold uppercase text-white shadow">
          Хит
        </span>
      )}

      {imageFailed ? (
        <div className="flex aspect-[4/3] items-center justify-center bg-green-100 text-5xl" aria-label={title}>
          🥗
        </div>
      ) : (
        <img
          src={imageUrl}
          alt={title}
          loading="lazy"
          onError={() => setImageFailed(true)}
          className="aspect-[4/3] w-full object-cover"
        />
      )}

      <div className="flex flex-1 flex-col gap-3 p-4">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500">{calories} ккал в день</p>

        <div className="flex gap-2" role="radiogroup" aria-label="Срок">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={days === d}
              onClick={() => setDays(d)}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-sm font-medium transition ${
                days === d
                  ? 'border-green-600 bg-green-50 text-green-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {d} {d === 1 ? 'день' : 'дней'}
            </button>
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between pt-2">
          <div>
            <span className="text-xl font-bold text-gray-900">{priceFormatter.format(price * days)}</span>
            {days > 1 && <p className="text-xs text-gray-500">{priceFormatter.format(price)} / день</p>}
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={justAdded}
            className={`min-w-32 rounded-lg px-4 py-2 text-sm font-medium text-white transition active:scale-95 ${
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
