import { describe, expect, it } from 'vitest';
import { OrderCalculationError } from '../types';
import type { CartItem, OrderCalculationErrorCode, OrderTotal, Promo } from '../types';
import { calculateOrderTotal } from './calculateOrderTotal';

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return { dietId: 'diet-1', pricePerDay: 100_000, days: 1, quantity: 1, ...overrides };
}

/** Считает заказ и попутно проверяет инварианты, общие для любого успешного расчёта. */
function calculate(items: readonly CartItem[], promo?: Promo): OrderTotal {
  const result = calculateOrderTotal(items, promo);
  const { subtotal, durationDiscount, promoDiscount, delivery, total, lines } = result;

  expect(total).toBe(subtotal - durationDiscount - promoDiscount + delivery);
  expect(subtotal).toBe(lines.reduce((acc, line) => acc + line.subtotal, 0));
  expect(durationDiscount).toBe(lines.reduce((acc, line) => acc + line.durationDiscount, 0));
  for (const value of [subtotal, durationDiscount, promoDiscount, delivery, total]) {
    expect(Number.isSafeInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
  }

  return result;
}

function expectCalculationError(run: () => unknown, code: OrderCalculationErrorCode): void {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(OrderCalculationError);
    if (error instanceof OrderCalculationError) {
      expect(error.code).toBe(code);
    }
    return;
  }
  expect.fail(`Ожидалась OrderCalculationError с кодом ${code}`);
}

describe('calculateOrderTotal', () => {
  describe('корзина', () => {
    it('пустая корзина — все суммы 0, доставка не начисляется', () => {
      expect(calculate([])).toEqual({
        lines: [],
        subtotal: 0,
        durationDiscount: 0,
        promoDiscount: 0,
        delivery: 0,
        total: 0,
      });
    });

    it('считает строку как цена × дни × количество', () => {
      const result = calculate([makeItem({ pricePerDay: 50_000, days: 1, quantity: 2 })]);

      expect(result.subtotal).toBe(100_000);
      expect(result.total).toBe(130_000);
    });

    it('нулевая цена допустима, доставка при этом платная', () => {
      const result = calculate([makeItem({ pricePerDay: 0 })]);

      expect(result.subtotal).toBe(0);
      expect(result.delivery).toBe(30_000);
      expect(result.total).toBe(30_000);
    });
  });

  describe('скидка за срок', () => {
    it('1 день — без скидки', () => {
      const result = calculate([makeItem({ pricePerDay: 100_000, days: 1 })]);

      expect(result.durationDiscount).toBe(0);
    });

    it('5 дней — скидка 5%', () => {
      const result = calculate([makeItem({ pricePerDay: 100_000, days: 5 })]);

      expect(result.subtotal).toBe(500_000);
      expect(result.durationDiscount).toBe(25_000);
    });

    it('7 дней — скидка 10%', () => {
      const result = calculate([makeItem({ pricePerDay: 100_000, days: 7 })]);

      expect(result.subtotal).toBe(700_000);
      expect(result.durationDiscount).toBe(70_000);
      expect(result.total).toBe(630_000);
    });

    it('один рацион с разными сроками — разные строки со своей скидкой', () => {
      const result = calculate([
        makeItem({ dietId: 'a', pricePerDay: 40_000, days: 1 }),
        makeItem({ dietId: 'a', pricePerDay: 40_000, days: 7 }),
      ]);

      expect(result.lines).toEqual([
        { dietId: 'a', days: 1, quantity: 1, subtotal: 40_000, durationDiscount: 0, total: 40_000 },
        { dietId: 'a', days: 7, quantity: 1, subtotal: 280_000, durationDiscount: 28_000, total: 252_000 },
      ]);
      expect(result.durationDiscount).toBe(28_000);
      expect(result.total).toBe(322_000);
    });

    it('округляет скидку построчно, а не от общей суммы', () => {
      // 5005 × 5% = 250.25 → 250 на строку; от суммы было бы 10010 × 5% = 500.5 → 501
      const result = calculate([
        makeItem({ dietId: 'a', pricePerDay: 1_001, days: 5 }),
        makeItem({ dietId: 'b', pricePerDay: 1_001, days: 5 }),
      ]);

      expect(result.durationDiscount).toBe(500);
      expect(result.lines.map((line) => line.total)).toEqual([4_755, 4_755]);
    });

    it('половину копейки округляет вверх', () => {
      // 5010 × 5% = 250.5
      const result = calculate([makeItem({ pricePerDay: 1_002, days: 5 })]);

      expect(result.durationDiscount).toBe(251);
    });
  });

  describe('доставка', () => {
    it('ровно 5000 ₽ — доставка бесплатная', () => {
      const result = calculate([makeItem({ pricePerDay: 100_000, days: 1, quantity: 5 })]);

      expect(result.delivery).toBe(0);
      expect(result.total).toBe(500_000);
    });

    it('4999,99 ₽ — доставка 300 ₽', () => {
      const result = calculate([makeItem({ pricePerDay: 499_999 })]);

      expect(result.delivery).toBe(30_000);
      expect(result.total).toBe(529_999);
    });

    it('порог считается после скидки за срок', () => {
      // 5000 ₽ без скидки, 4750 ₽ после −5%
      const result = calculate([makeItem({ pricePerDay: 100_000, days: 5 })]);

      expect(result.delivery).toBe(30_000);
      expect(result.total).toBe(505_000);
    });

    it('порог считается до промокода: промокод не увеличивает итог', () => {
      const items = [makeItem({ pricePerDay: 100_000, quantity: 5 })];
      const withoutPromo = calculate(items);
      const withPromo = calculate(items, { kind: 'fixed', amount: 10_000 });

      expect(withPromo.delivery).toBe(0);
      expect(withPromo.total).toBe(490_000);
      expect(withPromo.total).toBeLessThan(withoutPromo.total);
    });
  });

  describe('промокод', () => {
    it('процентный применяется к сумме после скидки за срок', () => {
      // 700 000 − 10% = 630 000; промокод 10% от 630 000
      const result = calculate([makeItem({ pricePerDay: 100_000, days: 7 })], {
        kind: 'percent',
        percent: 10,
      });

      expect(result.promoDiscount).toBe(63_000);
      expect(result.total).toBe(567_000);
    });

    it('фиксированный применяется к сумме после скидки за срок', () => {
      const result = calculate([makeItem({ pricePerDay: 100_000, days: 7 })], {
        kind: 'fixed',
        amount: 50_000,
      });

      expect(result.promoDiscount).toBe(50_000);
      expect(result.total).toBe(580_000);
    });

    it('поддерживает дробный процент', () => {
      const result = calculate([makeItem({ pricePerDay: 200_000 })], {
        kind: 'percent',
        percent: 7.5,
      });

      expect(result.promoDiscount).toBe(15_000);
    });

    it('фиксированный больше суммы товаров — товары 0, доставка остаётся', () => {
      const result = calculate([makeItem({ pricePerDay: 10_000 })], {
        kind: 'fixed',
        amount: 50_000,
      });

      expect(result.promoDiscount).toBe(10_000);
      expect(result.delivery).toBe(30_000);
      expect(result.total).toBe(30_000);
    });

    it('100% — товары бесплатны, доставка по правилу порога', () => {
      const result = calculate([makeItem({ pricePerDay: 10_000 })], {
        kind: 'percent',
        percent: 100,
      });

      expect(result.promoDiscount).toBe(10_000);
      expect(result.total).toBe(30_000);
    });

    it('не применяется к доставке', () => {
      const result = calculate([makeItem({ pricePerDay: 10_000 })], {
        kind: 'fixed',
        amount: 1_000_000,
      });

      expect(result.total).toBe(result.delivery);
    });
  });

  describe('валидация', () => {
    it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
      'цена за день %s — INVALID_PRICE',
      (pricePerDay) => {
        expectCalculationError(
          () => calculateOrderTotal([makeItem({ pricePerDay })]),
          'INVALID_PRICE',
        );
      },
    );

    it.each([0, -1, 1.5, Number.NaN])('количество %s — INVALID_QUANTITY', (quantity) => {
      expectCalculationError(
        () => calculateOrderTotal([makeItem({ quantity })]),
        'INVALID_QUANTITY',
      );
    });

    it('срок вне 1/5/7 — INVALID_DURATION', () => {
      expectCalculationError(
        // @ts-expect-error — тип запрещает срок 3 дня, проверяем рантайм-защиту
        () => calculateOrderTotal([makeItem({ days: 3 })]),
        'INVALID_DURATION',
      );
    });

    it.each<Promo>([
      { kind: 'percent', percent: 0 },
      { kind: 'percent', percent: -5 },
      { kind: 'percent', percent: 150 },
      { kind: 'percent', percent: Number.NaN },
      { kind: 'fixed', amount: 0 },
      { kind: 'fixed', amount: -100 },
      { kind: 'fixed', amount: 99.5 },
    ])('промокод %o — INVALID_PROMO', (promo) => {
      expectCalculationError(() => calculateOrderTotal([makeItem()], promo), 'INVALID_PROMO');
    });

    it('промокод с полями не своего вида — INVALID_PROMO', () => {
      expectCalculationError(
        // @ts-expect-error — у процентного промокода нет поля amount
        () => calculateOrderTotal([makeItem()], { kind: 'percent', amount: 100 }),
        'INVALID_PROMO',
      );
    });

    it('проверяет промокод даже при пустой корзине', () => {
      expectCalculationError(
        () => calculateOrderTotal([], { kind: 'percent', percent: 0 }),
        'INVALID_PROMO',
      );
    });
  });
});
