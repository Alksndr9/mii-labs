type LogLevel = 'info' | 'warning' | 'error'

export interface LogEntry {
  ts: string
  sessionId: string
  level: LogLevel
  event: string
  context?: Record<string, unknown>
}

const listeners: ((entry: LogEntry) => void)[] = []

// Псевдонимный id вкладки: связывает события одной сессии без ПДн (рекомендация AI-анализа логов)
const SESSION_ID = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : 'unknown'

/** Подписка на логи — используется для отправки ошибок во внешний сервис (аналитика/мониторинг). */
export function onLog(listener: (entry: LogEntry) => void): void {
  listeners.push(listener)
}

// Структурированный лог в JSON: такие строки удобно фильтровать и отдавать AI на анализ
function write(level: LogLevel, event: string, context?: Record<string, unknown>): LogEntry {
  const entry: LogEntry = { ts: new Date().toISOString(), sessionId: SESSION_ID, level, event, ...(context && { context }) }
  const line = JSON.stringify(entry)
  if (level === 'error') console.error(line)
  else if (level === 'warning') console.warn(line)
  else console.info(line)
  listeners.forEach((listener) => listener(entry))
  return entry
}

export const logger = {
  info: (event: string, context?: Record<string, unknown>) => write('info', event, context),
  warning: (event: string, context?: Record<string, unknown>) => write('warning', event, context),
  error: (event: string, context?: Record<string, unknown>) => write('error', event, context),
}
