import { useState } from 'react'
import { MealCard } from './components/MealCard'
import { meals } from './data/meals'

function App() {
  const [cartCount, setCartCount] = useState(0)

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Рационы</h1>
          <span className="rounded-full bg-white px-4 py-2 text-sm shadow">🛒 В корзине: {cartCount}</span>
        </header>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {meals.map((meal) => (
            <MealCard key={meal.id} {...meal} onAddToCart={() => setCartCount((n) => n + 1)} />
          ))}
        </div>
      </div>
    </main>
  )
}

export default App
