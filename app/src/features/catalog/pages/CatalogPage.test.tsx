import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CartProvider } from '../../cart/CartContext'
import { fetchMeals } from '../api/mealsApi'
import { MOCK_MEALS } from '../api/mockMeals'
import { CatalogPage } from './CatalogPage'

vi.mock('../api/mealsApi', () => ({ fetchMeals: vi.fn() }))

function renderPage() {
  return render(
    <CartProvider>
      <MemoryRouter>
        <CatalogPage />
      </MemoryRouter>
    </CartProvider>,
  )
}

describe('CatalogPage', () => {
  beforeEach(() => {
    vi.mocked(fetchMeals).mockReset()
    localStorage.clear()
  })

  it('показывает загрузку, затем карточки рационов', async () => {
    vi.mocked(fetchMeals).mockResolvedValue(MOCK_MEALS)
    renderPage()

    expect(screen.getByRole('status')).toHaveTextContent('Загружаем рационы')
    expect(await screen.findByRole('heading', { name: 'Баланс' })).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(MOCK_MEALS.length)
  })

  it('фильтрует рационы по цели и показывает пустое состояние', async () => {
    vi.mocked(fetchMeals).mockResolvedValue(MOCK_MEALS.filter((m) => m.goal !== 'vegetarian'))
    renderPage()
    await screen.findByRole('heading', { name: 'Баланс' })

    await userEvent.click(screen.getByRole('button', { name: 'Спорт' }))
    expect(screen.getAllByRole('article')).toHaveLength(1)

    await userEvent.click(screen.getByRole('button', { name: 'Вегетарианский' }))
    expect(screen.getByText('Рационов с такой целью пока нет')).toBeInTheDocument()
  })

  it('при ошибке сети показывает сообщение и повторяет запрос по кнопке', async () => {
    vi.mocked(fetchMeals).mockRejectedValueOnce(new Error('Не удалось загрузить рационы.')).mockResolvedValueOnce(MOCK_MEALS)
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить рационы.')
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }))

    expect(await screen.findByRole('heading', { name: 'Баланс' })).toBeInTheDocument()
    expect(fetchMeals).toHaveBeenCalledTimes(2)
  })
})
