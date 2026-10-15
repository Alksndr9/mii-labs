import { toApiError } from '../../../shared/api/apiError'
import { supabase } from '../../../shared/api/supabase'
import { MOCK_MEALS } from './mockMeals'
import type { Meal, MealGoal } from '../types'

const MOCK_DELAY_MS = 400

interface MealRow {
  id: string
  title: string
  description: string
  goal: MealGoal
  calories: number
  meals_per_day: number
  price_per_day: number
  image_url: string
  is_hit: boolean
  menu: string[]
}

function toMeal(row: MealRow): Meal {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    goal: row.goal,
    calories: row.calories,
    mealsPerDay: row.meals_per_day,
    pricePerDay: row.price_per_day,
    imageUrl: row.image_url,
    isHit: row.is_hit,
    menu: row.menu,
  }
}

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), MOCK_DELAY_MS))
}

export async function fetchMeals(): Promise<Meal[]> {
  if (!supabase) return delay(MOCK_MEALS)
  const { data, error, status } = await supabase.from('meals').select('*').order('price_per_day').returns<MealRow[]>()
  if (error) throw toApiError(error, status, 'fetchMeals')
  return data.map(toMeal)
}

export async function fetchMealById(id: string): Promise<Meal | null> {
  if (!supabase) return delay(MOCK_MEALS.find((meal) => meal.id === id) ?? null)
  const { data, error, status } = await supabase.from('meals').select('*').eq('id', id).returns<MealRow[]>().maybeSingle()
  if (error) throw toApiError(error, status, 'fetchMealById')
  return data ? toMeal(data) : null
}
