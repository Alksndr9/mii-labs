export type DietDuration = 1 | 5 | 7;

export const DIET_DURATIONS: readonly DietDuration[] = [1, 5, 7];

export function isDietDuration(value: unknown): value is DietDuration {
  return DIET_DURATIONS.some((duration) => duration === value);
}
