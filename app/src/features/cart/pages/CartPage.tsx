import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatRub } from '../../../shared/lib/formatMoney'
import { MealImage } from '../../../shared/ui/MealImage'
import { EmptyState } from '../../../shared/ui/StatusViews'
import { useCart } from '../cartContextValue'
import { OrderSummary } from '../components/OrderSummary'

export function CartPage() {
  const { lines, total, setQuantity, promoCode, applyPromo, clearPromo } = useCart()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [promoError, setPromoError] = useState<string | null>(null)

  if (lines.length === 0)
    return (
      <EmptyState title="Корзина пуста">
        <Link to="/" className="text-green-700 underline">Выбрать рацион</Link>
      </EmptyState>
    )

  return (
    <div className="grid gap-8 py-6 lg:grid-cols-[1fr_340px]">
      <section>
        <h1 className="mb-4 text-2xl font-semibold">Корзина</h1>
        <ul className="divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-100">
          {lines.map((line, i) => (
            <li key={`${line.dietId}-${line.days}`} className="flex flex-wrap items-center gap-4 p-4">
              <MealImage src={line.imageUrl} alt={line.title} className="h-16 w-16 shrink-0 rounded-xl text-2xl" />
              <div className="min-w-32 flex-1">
                <p className="font-medium">{line.title}</p>
                <p className="text-sm text-stone-500">{line.days === 1 ? '1 день' : `${line.days} дней`}</p>
              </div>
              <div className="flex items-center gap-2" aria-label={`Количество: ${line.title}`}>
                <button type="button" aria-label="Уменьшить" onClick={() => setQuantity(line.dietId, line.days, line.quantity - 1)} className="h-8 w-8 rounded-full border border-stone-300">−</button>
                <span className="w-6 text-center">{line.quantity}</span>
                <button type="button" aria-label="Увеличить" onClick={() => setQuantity(line.dietId, line.days, line.quantity + 1)} className="h-8 w-8 rounded-full border border-stone-300">+</button>
              </div>
              <p className="w-24 text-right font-semibold">{formatRub(total.lines[i].total)}</p>
            </li>
          ))}
        </ul>
      </section>

      <aside className="h-fit space-y-5 rounded-2xl bg-white p-5 ring-1 ring-stone-100">
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            setPromoError((await applyPromo(code)) ? null : 'Промокод не найден')
          }}
        >
          <label htmlFor="promo" className="text-sm font-medium">Промокод</label>
          {promoCode ? (
            <p className="mt-1 flex justify-between text-sm text-green-700">
              {promoCode} применён
              <button type="button" onClick={clearPromo} className="text-stone-500 underline">убрать</button>
            </p>
          ) : (
            <div className="mt-1 flex gap-2">
              <input id="promo" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ZELEN10" aria-invalid={promoError !== null} aria-describedby="promo-error" className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2 uppercase" />
              <button type="submit" className="rounded-lg border border-stone-900 px-3 text-sm">Применить</button>
            </div>
          )}
          {promoError && <p id="promo-error" role="alert" className="mt-1 text-sm text-red-700">{promoError}</p>}
        </form>
        <OrderSummary total={total} />
        <button type="button" onClick={() => navigate('/checkout')} className="w-full rounded-full bg-green-600 py-3 font-medium text-white hover:bg-green-700">
          Оформить заказ
        </button>
      </aside>
    </div>
  )
}
