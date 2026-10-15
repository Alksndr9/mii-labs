import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// PKCE: после OAuth в URL приходит одноразовый code, а не access_token (F-04 аудита)
/** null — Supabase не настроен: приложение работает на mock-данных (режим разработки фронтенда). */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey, { auth: { flowType: 'pkce' } }) : null
