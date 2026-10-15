import type { Promo } from './types'

// В MVP промокоды проверяются на клиенте; в проде их проверяет сервер (Supabase RPC)
const PROMO_CODES: Record<string, Promo> = {
  ZELEN10: { kind: 'percent', percent: 10 },
  MINUS500: { kind: 'fixed', amount: 50_000 },
}

export function findPromo(code: string): Promo | null {
  return PROMO_CODES[code.trim().toUpperCase()] ?? null
}
