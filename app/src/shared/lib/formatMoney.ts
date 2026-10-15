import type { Kopecks } from '../types/money'

const rubFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
})

export function formatRub(amount: Kopecks): string {
  return rubFormatter.format(amount / 100)
}
