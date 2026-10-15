import type { DietDuration } from '../../../shared/types/diet';
import type { Kopecks } from '../../../shared/types/money';

/** Record по DietDuration: при добавлении нового срока компилятор потребует указать для него скидку. */
export const DURATION_DISCOUNT_PERCENT: Readonly<Record<DietDuration, number>> = {
  1: 0,
  5: 5,
  7: 10,
};

export const DELIVERY_FEE: Kopecks = 30_000;

/** Порог включительный, сравнивается с суммой после скидки за срок, до промокода. */
export const FREE_DELIVERY_THRESHOLD: Kopecks = 500_000;
