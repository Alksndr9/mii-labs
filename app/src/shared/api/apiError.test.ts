import { describe, expect, it, vi } from 'vitest'
import { toApiError } from './apiError'

describe('toApiError', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})

  it.each([
    [{ message: 'JWT expired', code: 'PGRST303' }, 401, 'unauthorized', 'Сессия истекла'],
    [{ message: 'new row violates row-level security policy', code: '42501' }, 403, 'forbidden', 'Нет доступа'],
    [{ message: 'violates check constraint', code: '23514' }, 400, 'validation', 'Проверьте правильность'],
    [{ message: 'Internal Server Error' }, 500, 'server', 'временно недоступен'],
    [{ message: 'Failed to fetch' }, 0, 'network', 'Нет соединения'],
  ])('%o, HTTP %i → %s', (error, status, kind, text) => {
    const result = toApiError(error, status, 'test')
    expect(result.kind).toBe(kind)
    expect(result.message).toContain(text)
  })

  it('пишет ошибку сервера в структурированный JSON-лог', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    toApiError({ message: 'boom', code: 'XX000' }, 500, 'createOrder')
    const entry = JSON.parse(String(spy.mock.calls.at(-1)?.[0]))
    expect(entry).toMatchObject({ level: 'error', event: 'api_error', context: { operation: 'createOrder', status: 500, kind: 'server' } })
  })
})
