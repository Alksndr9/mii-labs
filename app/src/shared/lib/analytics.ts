import { logger, onLog } from './logger'

declare global {
  interface Window {
    ym?: (counterId: number, method: string, ...args: unknown[]) => void
  }
}

export type AnalyticsGoal = 'add_to_cart' | 'begin_checkout' | 'order_created' | 'promo_applied' | 'sign_up' | 'app_error'

const counterId = Number(import.meta.env.VITE_YANDEX_METRIKA_ID ?? 0)

/** Подключает счётчик Яндекс.Метрики. Без VITE_YANDEX_METRIKA_ID аналитика выключена (локальная разработка, тесты). */
export function initAnalytics(): void {
  if (!counterId || typeof document === 'undefined') return
  // Очередь вызовов до загрузки tag.js — стандартный приём сниппета Метрики
  const queue: unknown[][] = []
  window.ym = window.ym ?? Object.assign((...args: unknown[]) => void queue.push(args), { a: queue, l: Date.now() })
  const script = document.createElement('script')
  script.async = true
  script.src = 'https://mc.yandex.ru/metrika/tag.js'
  document.head.appendChild(script)
  window.ym(counterId, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: false })

  // Ошибки из структурированного лога дублируются в Метрику как цель — видно, на каком шаге воронки они случаются
  onLog((entry) => {
    if (entry.level === 'error') trackGoal('app_error', { event: entry.event })
  })
}

export function trackGoal(goal: AnalyticsGoal, params?: Record<string, unknown>): void {
  logger.info('analytics_goal', { goal, ...params })
  if (counterId && window.ym) window.ym(counterId, 'reachGoal', goal, params)
}

/** HashRouter не перезагружает страницу — переходы отправляются в Метрику вручную. */
export function trackPageView(path: string): void {
  if (counterId && window.ym) window.ym(counterId, 'hit', window.location.origin + import.meta.env.BASE_URL + '#' + path)
}
