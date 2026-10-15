import type { AuthError, User } from '@supabase/supabase-js'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../shared/api/supabase'
import { trackGoal } from '../../shared/lib/analytics'
import { logger } from '../../shared/lib/logger'
import { AuthContext, type AuthContextValue } from './authContextValue'

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Неверный email или пароль.',
  weak_password: 'Пароль слишком простой: минимум 8 символов.',
  email_not_confirmed: 'Подтвердите email — ссылка отправлена на почту.',
  over_request_rate_limit: 'Слишком много попыток. Подождите минуту.',
}

function authError(error: AuthError, action: string): Error {
  logger.warning('auth_error', { action, code: error.code, status: error.status })
  return new Error(AUTH_MESSAGES[error.code ?? ''] ?? 'Не удалось выполнить вход. Попробуйте ещё раз.')
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(supabase !== null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') logger.info('auth_' + event.toLowerCase())
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    const client = supabase
    return {
      enabled: client !== null,
      loading,
      user,
      signIn: async (email, password) => {
        if (!client) return
        const { error } = await client.auth.signInWithPassword({ email, password })
        if (error) throw authError(error, 'sign_in')
      },
      signUp: async (email, password) => {
        if (!client) return
        const { error } = await client.auth.signUp({ email, password })
        if (error) throw authError(error, 'sign_up')
        trackGoal('sign_up')
      },
      signInWithGoogle: async () => {
        if (!client) return
        const { error } = await client.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin + import.meta.env.BASE_URL },
        })
        if (error) throw authError(error, 'google')
      },
      signOut: async () => {
        await client?.auth.signOut()
      },
    }
  }, [loading, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
