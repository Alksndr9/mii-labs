import { logger, onLog } from './logger'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

export type AnalyticsGoal = 'add_to_cart' | 'begin_checkout' | 'order_created' | 'promo_applied' | 'sign_up' | 'app_error'

const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID ?? ''

/** Подключает Google Analytics 4. Без VITE_GA_MEASUREMENT_ID аналитика выключена (локальная разработка, тесты). */
export function initAnalytics(): void {
  if (!measurementId || typeof document === 'undefined') return
  // Очередь вызовов до загрузки gtag.js — стандартный сниппет GA4: gtag.js читает именно объект arguments
  window.dataLayer = window.dataLayer ?? []
  window.gtag = function gtag() {
    // oxlint-disable-next-line prefer-rest-params
    window.dataLayer?.push(arguments)
  }
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
  document.head.appendChild(script)
  window.gtag('js', new Date())
  // Просмотры страниц отправляем сами (trackPageView), иначе GA не увидит переходы HashRouter
  window.gtag('config', measurementId, { send_page_view: false })

  // Ошибки из структурированного лога дублируются в GA как событие — видно, на каком шаге воронки они случаются
  onLog((entry) => {
    if (entry.level === 'error') trackGoal('app_error', { event: entry.event })
  })
}

export function trackGoal(goal: AnalyticsGoal, params?: Record<string, unknown>): void {
  logger.info('analytics_goal', { goal, ...params })
  if (measurementId && window.gtag) window.gtag('event', goal, params)
}

/** HashRouter не перезагружает страницу — переходы отправляются в GA вручную. */
export function trackPageView(path: string): void {
  if (measurementId && window.gtag) {
    window.gtag('event', 'page_view', { page_location: window.location.origin + import.meta.env.BASE_URL + '#' + path, page_path: path })
  }
}
