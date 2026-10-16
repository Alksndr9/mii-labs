import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { consumeOAuthError } from './features/auth/oauthRedirect'
import { initAnalytics } from './shared/lib/analytics'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Не найден элемент #root')

consumeOAuthError()
initAnalytics()

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
