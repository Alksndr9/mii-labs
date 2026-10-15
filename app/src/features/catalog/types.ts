import type { Kopecks } from '../../shared/types/money'

export type MealGoal = 'balance' | 'weight-loss' | 'sport' | 'vegetarian'

export const GOAL_LABELS: Record<MealGoal, string> = {
  balance: 'Баланс',
  'weight-loss': 'Похудение',
  sport: 'Спорт',
  vegetarian: 'Вегетарианский',
}

export interface Meal {
  id: string
  title: string
  description: string
  goal: MealGoal
  calories: number
  mealsPerDay: number
  pricePerDay: Kopecks
  imageUrl: string
  isHit: boolean
  menu: string[]
}
