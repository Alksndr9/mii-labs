import { logger } from '../lib/logger'

export type ApiErrorKind = 'unauthorized' | 'forbidden' | 'validation' | 'not_found' | 'server' | 'network'

const USER_MESSAGES: Record<ApiErrorKind, string> = {
  unauthorized: 'Сессия истекла. Войдите в аккаунт ещё раз.',
  forbidden: 'Нет доступа к этим данным.',
  validation: 'Проверьте правильность введённых данных.',
  not_found: 'Данные не найдены.',
  server: 'Сервис временно недоступен. Попробуйте через минуту.',
  network: 'Нет соединения с сервером. Проверьте интернет и повторите.',
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  constructor(kind: ApiErrorKind) {
    super(USER_MESSAGES[kind])
    this.name = 'ApiError'
    this.kind = kind
  }
}

interface PostgrestLikeError {
  code?: string
  message: string
}

/**
 * Переводит ошибку Supabase/PostgREST в понятную пользователю.
 * Коды: 42501 и 401/403 — RLS/права, 23514/22P02/23502 — нарушение ограничений БД, PGRST116 — запись не найдена.
 */
export function toApiError(error: PostgrestLikeError, status: number | undefined, operation: string): ApiError {
  let kind: ApiErrorKind
  if (status === 401 || error.code === 'PGRST301' || error.code === 'PGRST303') kind = 'unauthorized'
  else if (status === 403 || error.code === '42501') kind = 'forbidden'
  else if (error.code === '23514' || error.code === '22P02' || error.code === '23502' || status === 400) kind = 'validation'
  else if (error.code === 'PGRST116' || status === 404) kind = 'not_found'
  else if (status === undefined || status === 0) kind = 'network'
  else kind = 'server'

  logger[kind === 'server' || kind === 'network' ? 'error' : 'warning']('api_error', {
    operation,
    kind,
    status,
    code: error.code,
    message: error.message,
  })
  return new ApiError(kind)
}
