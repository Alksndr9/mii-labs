# Шаг 3. Реализация `calculateOrderTotal` и тесты

## План изменений

1. `src/shared/types/money.ts`: тип `Kopecks`, без изменений относительно шага 2.
2. `src/shared/types/diet.ts`: `DietDuration` и реализация type guard `isDietDuration`. Тест лежит рядом, в `diet.test.ts`.
3. `src/features/cart/types.ts`: типы из шага 2 и реализация `OrderCalculationError`.
4. `src/features/cart/lib/pricingRules.ts`: бизнес-константы.
5. `src/features/cart/lib/calculateOrderTotal.ts`: чистая функция расчёта с проверкой входных данных.
6. `src/features/cart/lib/calculateOrderTotal.test.ts`: тесты по всем граничным случаям из шага 1. Каждый успешный расчёт дополнительно проверяется на инвариант суммы.

Импорты относительные: алиас `@/` из шага 2 требует настройки `vite.config.ts` и `tsconfig.json`, а проекта пока нет.

---

### `src/shared/types/money.ts`

```ts
/**
 * Сумма в копейках, целое число.
 * Псевдоним, а не branded type: брендирование потребовало бы `as` при каждом
 * получении данных из Supabase, а это запрещено правилами проекта.
 */
export type Kopecks = number;
```

### `src/shared/types/diet.ts`

```ts
export type DietDuration = 1 | 5 | 7;

export const DIET_DURATIONS: readonly DietDuration[] = [1, 5, 7];

export function isDietDuration(value: unknown): value is DietDuration {
  return DIET_DURATIONS.some((duration) => duration === value);
}
```

### `src/shared/types/diet.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { isDietDuration } from './diet';

describe('isDietDuration', () => {
  it.each([1, 5, 7])('принимает допустимый срок %s', (value) => {
    expect(isDietDuration(value)).toBe(true);
  });

  it.each([0, 3, 14, -1, 5.5, Number.NaN, '5', null, undefined, {}])(
    'отклоняет %s',
    (value) => {
      expect(isDietDuration(value)).toBe(false);
    },
  );
});
```

### `src/features/cart/types.ts`

```ts
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
```

### `src/features/cart/lib/pricingRules.ts`

```ts
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
```

### `src/features/cart/lib/calculateOrderTotal.ts`

```ts
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
```

### `src/features/cart/lib/calculateOrderTotal.test.ts`

```ts
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
```

---

## Как проверить

Как вы просили, файлы я не создавал, поэтому **тесты не запускались**. Все ожидаемые значения в них я посчитал вручную. После переноса кода в проект на Vite с Vitest:

```bash
npx vitest run src/features/cart src/shared/types
npx tsc --noEmit                    # проверит, что @ts-expect-error действительно ловят ошибки типов
```

Обычный `vitest run` не проверяет типы. Если `tsc` или `vitest --typecheck` сообщит «Unused '@ts-expect-error' directive», значит типы перестали запрещать некорректный ввод.

## Известные ограничения

- **Округление дробного процента.** Для целых процентов и процентов с шагом 0,5 вычисление `amount × percent / 100` точное. Для процентов вроде 7,3 возможна погрешность float на границе 0,5 копейки. Если маркетинг будет давать такие промокоды, процент стоит хранить в базисных пунктах (целое число, 730) и считать в целых.
- **Переполнение не проверяется.** `Number.isSafeInteger` проверяет только входные значения, а произведение `цена × дни × количество` не проверяется. Для реальных корзин это недостижимо (больше 90 трлн ₽).
- **Невалидный `kind` промокода из рантайма** (например, `'gift'`) попадает в ветку фиксированного промокода. Ошибка `INVALID_PROMO` выбрасывается, только если в нём нет корректного `amount`. Строгая проверка `kind` нужна при разборе ответа API, в слое `api/`.
- **Расчёт только предварительный.** Сумму к оплате должен пересчитывать сервер (Supabase RPC или Edge Function) по тем же правилам. Иначе логика будет продублирована, и при изменении правил её нужно будет синхронизировать вручную.
