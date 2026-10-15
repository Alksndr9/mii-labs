import type { DietDuration } from '../../shared/types/diet';
import type { Kopecks } from '../../shared/types/money';

export interface CartItem {
  readonly dietId: string;
  /** Цена за один день, копейки, целое ≥ 0. */
  readonly pricePerDay: Kopecks;
  readonly days: DietDuration;
  /** Целое ≥ 1. */
  readonly quantity: number;
}

/**
 * Промокод, уже проверенный сервером (срок действия, лимиты).
 * Функция расчёта проверяет только корректность значений.
 */
export type Promo =
  | {
      readonly kind: 'percent';
      /** 0 < percent ≤ 100, допускается дробное (например, 7.5). */
      readonly percent: number;
    }
  | {
      readonly kind: 'fixed';
      /** Копейки, целое > 0. */
      readonly amount: Kopecks;
    };

/**
 * Разбивка одной строки корзины. Нужна, потому что скидка за срок округляется
 * построчно: UI показывает цену каждой строки, и сумма строк сходится с итогом.
 */
export interface LineBreakdown {
  readonly dietId: string;
  readonly days: DietDuration;
  readonly quantity: number;
  /** pricePerDay × days × quantity. */
  readonly subtotal: Kopecks;
  readonly durationDiscount: Kopecks;
  /** subtotal − durationDiscount. */
  readonly total: Kopecks;
}

/**
 * Все поля в копейках, все ≥ 0. Инвариант:
 * total === subtotal − durationDiscount − promoDiscount + delivery
 */
export interface OrderTotal {
  readonly lines: readonly LineBreakdown[];
  readonly subtotal: Kopecks;
  readonly durationDiscount: Kopecks;
  readonly promoDiscount: Kopecks;
  readonly delivery: Kopecks;
  readonly total: Kopecks;
}

export type OrderCalculationErrorCode =
  | 'INVALID_PRICE'
  | 'INVALID_QUANTITY'
  | 'INVALID_DURATION'
  | 'INVALID_PROMO';

export class OrderCalculationError extends Error {
  readonly code: OrderCalculationErrorCode;

  constructor(code: OrderCalculationErrorCode, message: string) {
    super(message);
    this.name = 'OrderCalculationError';
    this.code = code;
  }
}
