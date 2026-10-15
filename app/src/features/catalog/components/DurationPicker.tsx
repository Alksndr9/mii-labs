import { DIET_DURATIONS, type DietDuration } from '../../../shared/types/diet'
import { DURATION_DISCOUNT_PERCENT } from '../../cart/lib/pricingRules'

interface DurationPickerProps {
  value: DietDuration
  onChange: (value: DietDuration) => void
}

function daysLabel(days: DietDuration): string {
  return days === 1 ? '1 день' : `${days} дней`
}

export function DurationPicker({ value, onChange }: DurationPickerProps) {
  return (
    <div className="flex gap-2" role="radiogroup" aria-label="Срок">
      {DIET_DURATIONS.map((days) => {
        const discount = DURATION_DISCOUNT_PERCENT[days]
        return (
          <button
            key={days}
            type="button"
            role="radio"
            aria-checked={value === days}
            onClick={() => onChange(days)}
            className={`flex-1 rounded-xl border px-2 py-1.5 text-sm transition ${
              value === days ? 'border-green-600 bg-green-50 font-medium text-green-800' : 'border-stone-200 text-stone-600 hover:border-stone-300'
            }`}
          >
            {daysLabel(days)}
            {discount > 0 && <span className="block text-xs text-green-700">−{discount}%</span>}
          </button>
        )
      })}
    </div>
  )
}
