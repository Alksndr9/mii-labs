import type { User } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

export interface AuthContextValue {
  /** false — Supabase не настроен, приложение в демо-режиме без авторизации */
  enabled: boolean
  loading: boolean
  user: User | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth должен использоваться внутри AuthProvider')
  return ctx
}
