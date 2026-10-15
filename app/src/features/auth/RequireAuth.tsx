import { Navigate, useLocation } from 'react-router-dom'
import { LoadingState } from '../../shared/ui/StatusViews'
import { useAuth } from './authContextValue'

/** Пропускает только авторизованных; в демо-режиме (без Supabase) пропускает всех. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { enabled, loading, user } = useAuth()
  const location = useLocation()

  if (!enabled) return children
  if (loading) return <LoadingState label="Проверяем вход…" />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}
