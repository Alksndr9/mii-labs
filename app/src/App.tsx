import { HashRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './app/Layout'
import { CartProvider } from './features/cart/CartContext'
import { CartPage } from './features/cart/pages/CartPage'
import { CatalogPage } from './features/catalog/pages/CatalogPage'
import { MealPage } from './features/catalog/pages/MealPage'
import { CheckoutPage } from './features/checkout/pages/CheckoutPage'
import { EmptyState } from './shared/ui/StatusViews'

// HashRouter: GitHub Pages отдаёт 404 на прямые ссылки вида /cart, а /#/cart работает всегда
export function App() {
  return (
    <CartProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<CatalogPage />} />
            <Route path="meals/:id" element={<MealPage />} />
            <Route path="cart" element={<CartPage />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="*" element={<EmptyState title="Страница не найдена" />} />
          </Route>
        </Routes>
      </HashRouter>
    </CartProvider>
  )
}
