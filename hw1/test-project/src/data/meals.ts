export interface Meal {
  id: string
  title: string
  calories: number
  /** Цена за один день, ₽ */
  price: number
  imageUrl: string
  isHit?: boolean
}

export const meals: Meal[] = [
  {
    id: 'balance',
    title: 'Баланс — рацион на день',
    calories: 1800,
    price: 1490,
    imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600',
    isHit: true,
  },
  {
    id: 'fit',
    title: 'Фит — снижение веса',
    calories: 1400,
    price: 1290,
    imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600',
  },
  {
    id: 'sport',
    title: 'Спорт — набор массы',
    calories: 2600,
    price: 1890,
    imageUrl: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600',
  },
]
