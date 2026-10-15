import { isDietDuration } from '../../../shared/types/diet';
import type { Kopecks } from '../../../shared/types/money';
import { OrderCalculationError } from '../types';
import type { CartItem, LineBreakdown, OrderTotal, Promo } from '../types';
import {
  DELIVERY_FEE,
  DURATION_DISCOUNT_PERCENT,
  FREE_DELIVERY_THRESHOLD,
} from './pricingRules';

function percentOf(amount: Kopecks, percent: number): Kopecks {
  return Math.round((amount * percent) / 100);
}

function sum(values: readonly Kopecks[]): Kopecks {
  return values.reduce((acc, value) => acc + value, 0);
}

// Типы не защищают от данных из Supabase и localStorage, поэтому проверяем в рантайме.
function assertValidItem(item: CartItem): void {
  if (!Number.isSafeInteger(item.pricePerDay) || item.pricePerDay < 0) {
    throw new OrderCalculationError(
      'INVALID_PRICE',
      `Некорректная цена за день у рациона ${item.dietId}: ${item.pricePerDay}`,
    );
  }
  if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) {
    throw new OrderCalculationError(
      'INVALID_QUANTITY',
      `Некорректное количество у рациона ${item.dietId}: ${item.quantity}`,
    );
  }
  if (!isDietDuration(item.days)) {
    throw new OrderCalculationError(
      'INVALID_DURATION',
      `Некорректный срок у рациона ${item.dietId}: ${String(item.days)}`,
    );
  }
}

function assertValidPromo(promo: Promo): void {
  const isValid =
    promo.kind === 'percent'
      ? Number.isFinite(promo.percent) && promo.percent > 0 && promo.percent <= 100
      : Number.isSafeInteger(promo.amount) && promo.amount > 0;

  if (!isValid) {
    throw new OrderCalculationError(
      'INVALID_PROMO',
      `Некорректный промокод: ${JSON.stringify(promo)}`,
    );
  }
}

function calculateLine(item: CartItem): LineBreakdown {
  const subtotal = item.pricePerDay * item.days * item.quantity;
  const durationDiscount = percentOf(subtotal, DURATION_DISCOUNT_PERCENT[item.days]);

  return {
    dietId: item.dietId,
    days: item.days,
    quantity: item.quantity,
    subtotal,
    durationDiscount,
    total: subtotal - durationDiscount,
  };
}

function calculatePromoDiscount(goodsTotal: Kopecks, promo: Promo): Kopecks {
  const discount =
    promo.kind === 'percent' ? percentOf(goodsTotal, promo.percent) : promo.amount;

  return Math.min(discount, goodsTotal);
}

// Порог проверяется до промокода: иначе промокод мог бы опустить сумму ниже порога
// и итог вырос бы за счёт платной доставки.
function calculateDelivery(itemCount: number, goodsTotal: Kopecks): Kopecks {
  if (itemCount === 0 || goodsTotal >= FREE_DELIVERY_THRESHOLD) {
    return 0;
  }
  return DELIVERY_FEE;
}

/**
 * Предварительный расчёт стоимости заказа для UI.
 * Сумму к оплате всё равно пересчитывает сервер, клиенту в этом доверять нельзя.
 *
 * Порядок: строка → скидка за срок (по строке) → порог доставки → промокод → итог.
 *
 * @throws {OrderCalculationError} при некорректной цене, количестве, сроке или промокоде.
 */
export function calculateOrderTotal(items: readonly CartItem[], promo?: Promo): OrderTotal {
  items.forEach(assertValidItem);
  if (promo !== undefined) {
    assertValidPromo(promo);
  }

  const lines = items.map(calculateLine);
  const subtotal = sum(lines.map((line) => line.subtotal));
  const durationDiscount = sum(lines.map((line) => line.durationDiscount));
  const goodsTotal = subtotal - durationDiscount;
  const promoDiscount = promo === undefined ? 0 : calculatePromoDiscount(goodsTotal, promo);
  const delivery = calculateDelivery(lines.length, goodsTotal);

  return {
    lines,
    subtotal,
    durationDiscount,
    promoDiscount,
    delivery,
    total: goodsTotal - promoDiscount + delivery,
  };
}
