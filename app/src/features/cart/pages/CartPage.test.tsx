import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { CartProvider } from '../CartContext'
import { CartPage } from './CartPage'

function renderWithCart(lines: unknown[]) {
  localStorage.setItem('zelen-cart-v1', JSON.stringify(lines))
  return render(
    <CartProvider>
      <MemoryRouter>
        <CartPage />
      </MemoryRouter>
    </CartProvider>,
  )
}

const BALANCE_7_DAYS = { dietId: 'balance', title: 'Баланс', imageUrl: '', pricePerDay: 149_000, days: 7, quantity: 1 }

describe('CartPage', () => {
  beforeEach(() => localStorage.clear())

  it('показывает пустую корзину', () => {
    renderWithCart([])
    expect(screen.getByText('Корзина пуста')).toBeInTheDocument()
  })

  it('считает скидку за 7 дней и бесплатную доставку от 5000 ₽', () => {
    renderWithCart([BALANCE_7_DAYS])
    const summary = screen.getByText('Итого').closest('dl')
    if (!summary) throw new Error('нет блока итога')

    // 1 490 ₽ × 7 = 10 430 ₽, скидка 10% = 1 043 ₽
    expect(within(summary).getByText(/1\s043/)).toBeInTheDocument()
    expect(within(summary).getByText('бесплатно')).toBeInTheDocument()
    expect(within(summary).getByText(/9\s387/)).toBeInTheDocument()
  })

  it('удаляет позицию при уменьшении количества до нуля', async () => {
    renderWithCart([BALANCE_7_DAYS])
    await userEvent.click(screen.getByRole('button', { name: 'Уменьшить' }))
    expect(screen.getByText('Корзина пуста')).toBeInTheDocument()
  })

  it('сообщает о неверном промокоде и применяет верный', async () => {
    renderWithCart([BALANCE_7_DAYS])
    const input = screen.getByLabelText('Промокод')

    await userEvent.type(input, 'NOPE')
    await userEvent.click(screen.getByRole('button', { name: 'Применить' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Промокод не найден')

    await userEvent.clear(input)
    await userEvent.type(input, 'zelen10')
    await userEvent.click(screen.getByRole('button', { name: 'Применить' }))
    expect(screen.getByText('ZELEN10 применён')).toBeInTheDocument()
  })

  it('игнорирует повреждённые данные корзины из localStorage', () => {
    renderWithCart([{ dietId: 'x', days: 3 }, 'мусор', BALANCE_7_DAYS])
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })
})
