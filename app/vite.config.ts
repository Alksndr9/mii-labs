/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// F-05 аудита: GitHub Pages не даёт задать HTTP-заголовки, поэтому CSP задаётся meta-тегом.
// Только для production-сборки: dev-сервер Vite использует inline-скрипты для hot reload.
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://mc.yandex.ru https://yastatic.net",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://mc.yandex.ru https://mc.yandex.com",
  "img-src 'self' data: https://images.unsplash.com https://mc.yandex.ru https://mc.yandex.com",
  "style-src 'self' 'unsafe-inline'",
  "frame-src https://mc.yandex.ru https://mc.yandex.com",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

function contentSecurityPolicy(): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  }
}

// base — путь репозитория на GitHub Pages: https://alksndr9.github.io/mii-labs/
export default defineConfig({
  base: '/mii-labs/',
  plugins: [react(), tailwindcss(), contentSecurityPolicy()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // тесты не ходят в настоящий Supabase из .env.local — только mock-данные
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  },
})
