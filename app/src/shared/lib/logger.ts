type LogLevel = 'info' | 'warning' | 'error'

export interface LogEntry {
  ts: string
  level: LogLevel
  event: string
  context?: Record<string, unknown>
}

const listeners: ((entry: LogEntry) => void)[] = []

/** Подписка на логи — используется для отправки ошибок во внешний сервис (аналитика/мониторинг). */
export function onLog(listener: (entry: LogEntry) => void): void {
  listeners.push(listener)
}

// Структурированный лог в JSON: такие строки удобно фильтровать и отдавать AI на анализ
function write(level: LogLevel, event: string, context?: Record<string, unknown>): LogEntry {
  const entry: LogEntry = { ts: new Date().toISOString(), level, event, ...(context && { context }) }
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
