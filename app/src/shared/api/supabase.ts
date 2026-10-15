import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** null — Supabase не настроен: приложение работает на mock-данных (режим разработки фронтенда). */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null
