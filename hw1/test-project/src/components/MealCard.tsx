import { useState } from 'react'

interface MealCardProps {
  title: string
  calories: number
  price: number
  imageUrl: string
  onAddToCart: () => void
}

const priceFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
})

export function MealCard({ title, calories, price, imageUrl, onAddToCart }: MealCardProps) {
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-md transition hover:shadow-lg">
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

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500">{calories} ккал в день</p>

        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-xl font-bold text-gray-900">{priceFormatter.format(price)}</span>
          <button
            type="button"
            onClick={onAddToCart}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 active:scale-95"
          >
            В корзину
          </button>
        </div>
      </div>
    </article>
  )
}
