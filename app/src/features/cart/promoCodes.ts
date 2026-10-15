import { supabase } from '../../shared/api/supabase'
import type { Promo } from './types'

// Демо-режим без бэкенда: коды для проверки UI. С Supabase промокоды проверяет сервер (RPC get_promo, F-02 аудита)
const DEMO_PROMO_CODES: Record<string, Promo> = {
  ZELEN10: { kind: 'percent', percent: 10 },
  MINUS500: { kind: 'fixed', amount: 50_000 },
}

export async function findPromo(code: string): Promise<Promo | null> {
  const normalized = code.trim().toUpperCase()
  if (!supabase) return DEMO_PROMO_CODES[normalized] ?? null

  const { data, error } = await supabase.rpc('get_promo', { p_code: normalized })
  const row: unknown = Array.isArray(data) ? data[0] : null
  if (error || !isPromoRow(row)) return null
  return row.kind === 'percent' ? { kind: 'percent', percent: row.value } : { kind: 'fixed', amount: row.value }
}

function isPromoRow(value: unknown): value is { kind: 'percent' | 'fixed'; value: number } {
  if (typeof value !== 'object' || value === null) return false
  const v: Record<string, unknown> = { ...value }
  return (v.kind === 'percent' || v.kind === 'fixed') && Number.isInteger(v.value)
}
