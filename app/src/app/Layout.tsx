import { Link, NavLink, Outlet } from 'react-router-dom'
import { useCart } from '../features/cart/cartContextValue'

export function Layout() {
  const { itemCount } = useCart()
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="sticky top-0 z-20 border-b border-stone-100 bg-stone-50/90 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-8">
          <Link to="/" className="font-bold tracking-wide">ЗЕЛЕНЬ</Link>
          <div className="flex items-center gap-4 text-sm sm:gap-8">
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'text-stone-900' : 'text-stone-500')}>Рационы</NavLink>
            <NavLink to="/cart" className="rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-stone-200">
              Корзина · {itemCount}
            </NavLink>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 sm:px-8">
        <Outlet />
      </main>
    </div>
  )
}
