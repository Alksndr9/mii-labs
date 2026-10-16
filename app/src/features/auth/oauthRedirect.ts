import { logger } from '../../shared/lib/logger'

/**
 * Supabase возвращает ошибку OAuth параметрами в URL (`?error=…#error=…`).
 * HashRouter принял бы `#error=…` за маршрут и показал 404, поэтому до рендера
 * переносим ошибку в `#/login?oauth_error=…`, где её покажет страница входа.
 */
export function consumeOAuthError(loc: Location = window.location, history: History = window.history): void {
  const hash = loc.hash.startsWith('#/') ? '' : loc.hash.slice(1)
  const params = new URLSearchParams(loc.search)
  new URLSearchParams(hash).forEach((value, key) => params.set(key, value))
  const error = params.get('error')
  if (!error) return

  const code = params.get('error_code') ?? error
  logger.warning('auth_error', { action: 'google_callback', code })
  history.replaceState(null, '', `${loc.pathname}#/login?oauth_error=${encodeURIComponent(code)}`)
}
