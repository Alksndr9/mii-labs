import { lazy, Suspense, useEffect } from 'react'
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom'
import { Layout } from './app/Layout'
import { AuthProvider } from './features/auth/AuthProvider'
import { RequireAuth } from './features/auth/RequireAuth'
import { CartProvider } from './features/cart/CartContext'
import { CartPage } from './features/cart/pages/CartPage'
import { CatalogPage } from './features/catalog/pages/CatalogPage'
import { MealPage } from './features/catalog/pages/MealPage'
import { trackPageView } from './shared/lib/analytics'
import { EmptyState, LoadingState } from './shared/ui/StatusViews'

// Страницы, не нужные на первом экране, грузятся отдельными чанками
const LoginPage = lazy(() => import('./features/auth/pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const CheckoutPage = lazy(() => import('./features/checkout/pages/CheckoutPage').then((m) => ({ default: m.CheckoutPage })))
const OrdersPage = lazy(() => import('./features/orders/pages/OrdersPage').then((m) => ({ default: m.OrdersPage })))

function PageViewTracker() {
  const { pathname } = useLocation()
  useEffect(() => trackPageView(pathname), [pathname])
  return null
}

// HashRouter: GitHub Pages отдаёт 404 на прямые ссылки вида /cart, а /#/cart работает всегда
export function App() {
  return (
    <AuthProvider>
    <CartProvider>
      <HashRouter>
        <PageViewTracker />
        <Suspense fallback={<LoadingState />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<CatalogPage />} />
            <Route path="meals/:id" element={<MealPage />} />
            <Route path="cart" element={<CartPage />} />
            <Route path="checkout" element={<RequireAuth><CheckoutPage /></RequireAuth>} />
            <Route path="orders" element={<RequireAuth><OrdersPage /></RequireAuth>} />
            <Route path="login" element={<LoginPage />} />
            <Route path="*" element={<EmptyState title="Страница не найдена" />} />
          </Route>
        </Routes>
        </Suspense>
      </HashRouter>
    </CartProvider>
    </AuthProvider>
  )
}
