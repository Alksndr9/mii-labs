import { describe, expect, it, vi } from 'vitest'
import { consumeOAuthError } from './oauthRedirect'

function run(url: string) {
  const u = new URL(url)
  const replaceState = vi.fn()
  consumeOAuthError({ hash: u.hash, search: u.search, pathname: u.pathname } as Location, { replaceState } as unknown as History)
  return replaceState.mock.calls[0]?.[2] as string | undefined
}

describe('consumeOAuthError', () => {
  it('переносит ошибку из hash на страницу входа', () => {
    expect(run('https://x.io/mii-labs/#error=server_error&error_code=unexpected_failure&error_description=Unable')).toBe('/mii-labs/#/login?oauth_error=unexpected_failure')
  })

  it('берёт ошибку из query, если кода нет', () => {
    expect(run('https://x.io/mii-labs/?error=access_denied')).toBe('/mii-labs/#/login?oauth_error=access_denied')
  })

  it('не трогает обычные маршруты и успешный code', () => {
    expect(run('https://x.io/mii-labs/#/cart')).toBeUndefined()
    expect(run('https://x.io/mii-labs/?code=abc')).toBeUndefined()
  })
})
