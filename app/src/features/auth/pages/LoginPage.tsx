import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../authContextValue'

export function LoginPage() {
  const { enabled, user, signIn, signUp, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = typeof location.state?.from === 'string' ? location.state.from : '/'
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!enabled) return <p className="py-16 text-center text-stone-500">Демо-режим: авторизация отключена, Supabase не настроен.</p>
  if (user) return <Navigate to={from} replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'signIn') {
        await signIn(email, password)
        navigate(from, { replace: true })
      } else {
        await signUp(email, password)
        setInfo('Аккаунт создан. Если включено подтверждение email — проверьте почту.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm py-12">
      <h1 className="mb-6 text-2xl font-semibold">{mode === 'signIn' ? 'Вход' : 'Регистрация'}</h1>
      <button type="button" onClick={() => signInWithGoogle().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Ошибка входа'))} className="w-full rounded-full border border-stone-300 bg-white py-2.5 font-medium hover:bg-stone-50">
        Войти через Google
      </button>
      <p className="my-4 text-center text-sm text-stone-400">или по email</p>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm">
          Email
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
        </label>
        <label className="block text-sm">
          Пароль
          <input type="password" required minLength={6} autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" />
        </label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {info && <p role="status" className="text-sm text-green-700">{info}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-full bg-green-600 py-2.5 font-medium text-white hover:bg-green-700 disabled:opacity-60">
          {busy ? 'Подождите…' : mode === 'signIn' ? 'Войти' : 'Зарегистрироваться'}
        </button>
      </form>
      <button type="button" onClick={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')} className="mt-4 w-full text-sm text-stone-500 underline">
        {mode === 'signIn' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
      </button>
    </div>
  )
}
