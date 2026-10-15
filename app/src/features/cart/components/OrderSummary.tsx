import { formatRub } from '../../../shared/lib/formatMoney'
import { FREE_DELIVERY_THRESHOLD } from '../lib/pricingRules'
import type { OrderTotal } from '../types'

export function OrderSummary({ total }: { total: OrderTotal }) {
  const goodsAfterDuration = total.subtotal - total.durationDiscount
  const toFreeDelivery = FREE_DELIVERY_THRESHOLD - goodsAfterDuration

  return (
    <dl className="space-y-2 text-sm">
      <Row label="Сумма" value={formatRub(total.subtotal)} />
      {total.durationDiscount > 0 && <Row label="Скидка за срок" value={`−${formatRub(total.durationDiscount)}`} accent />}
      {total.promoDiscount > 0 && <Row label="Промокод" value={`−${formatRub(total.promoDiscount)}`} accent />}
      <Row label="Доставка" value={total.delivery === 0 ? 'бесплатно' : formatRub(total.delivery)} accent={total.delivery === 0} />
      {toFreeDelivery > 0 && goodsAfterDuration > 0 && (
        <p className="text-xs text-stone-500">До бесплатной доставки: {formatRub(toFreeDelivery)}</p>
      )}
      <div className="flex justify-between border-t border-stone-200 pt-3 text-lg font-bold">
        <dt>Итого</dt>
        <dd>{formatRub(total.total)}</dd>
      </div>
    </dl>
  )
}

function Row({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-stone-500">{label}</dt>
      <dd className={accent ? 'text-green-700' : ''}>{value}</dd>
    </div>
  )
}
