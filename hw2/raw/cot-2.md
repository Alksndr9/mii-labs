# Шаг 2. Типы и сигнатура `calculateOrderTotal`

## План изменений

1. `src/shared/types/money.ts`: тип `Kopecks`. Деньги используются и в каталоге, и в корзине, поэтому он в `shared`.
2. `src/shared/types/diet.ts`: тип `DietDuration` (1 / 5 / 7) и type guard для данных из Supabase и `localStorage`. Срок — свойство рациона, а не корзины, а фичи не должны импортировать друг из друга.
3. `src/features/cart/types.ts`: входные и выходные типы расчёта (`CartItem`, `Promo`, `LineBreakdown`, `OrderTotal`) и тип ошибки.
4. `src/features/cart/lib/pricingRules.ts`: бизнес-константы (скидки за срок, доставка, порог).
5. `src/features/cart/lib/calculateOrderTotal.ts`: сигнатура и контракт функции. Тело будет на шаге 3.

Файлы на диск пока не записываю: в шаге 2 только проектирование, реализацию, файлы и тесты сделаем на шаге 3 после вашего согласования.

---

### `src/shared/types/money.ts`

```ts
/**
 * Сумма в копейках, целое число.
 * Псевдоним, а не branded type: брендирование потребовало бы `as` при каждом
 * получении данных из Supabase, а это запрещено правилами проекта.
 * Целочисленность и неотрицательность проверяются в рантайме там, где данные входят в расчёт.
 */
export type Kopecks = number;
```

### `src/shared/types/diet.ts`

```ts
export type DietDuration = 1 | 5 | 7;

export const DIET_DURATIONS: readonly DietDuration[] = [1, 5, 7];

/** Сужает unknown из API или localStorage до DietDuration без приведения типов. */
export function isDietDuration(value: unknown): value is DietDuration;
```

### `src/features/cart/types.ts`

```ts
import type { Kopecks } from '@/shared/types/money';
import type { DietDuration } from '@/shared/types/diet';

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
  /** Сумма без скидок. */
  readonly subtotal: Kopecks;
  /** Сумма скидок за срок по всем строкам. */
  readonly durationDiscount: Kopecks;
  /** Не больше суммы товаров после скидки за срок. */
  readonly promoDiscount: Kopecks;
  /** 0 или DELIVERY_FEE; 0 для пустой корзины. */
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
  constructor(code: OrderCalculationErrorCode, message: string);
}
```

### `src/features/cart/lib/pricingRules.ts`

```ts
import type { Kopecks } from '@/shared/types/money';
import type { DietDuration } from '@/shared/types/diet';

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
import type { CartItem, OrderTotal, Promo } from '../types';

/**
 * Предварительный расчёт стоимости заказа для UI.
 * Сумму к оплате всё равно пересчитывает сервер, клиенту в этом доверять нельзя.
 *
 * Порядок:
 * 1. Строка: pricePerDay × days × quantity.
 * 2. Скидка за срок для каждой строки, округление Math.round.
 * 3. Порог бесплатной доставки по сумме после шага 2 (≥ FREE_DELIVERY_THRESHOLD).
 * 4. Промокод к сумме после шага 2, ограничен ею сверху, к доставке не применяется.
 * 5. total = товары после промокода + доставка.
 *
 * Пустая корзина: все поля 0, включая доставку.
 *
 * @throws {OrderCalculationError} при некорректной цене, количестве, сроке или промокоде.
 */
export function calculateOrderTotal(
  items: readonly CartItem[],
  promo?: Promo,
): OrderTotal;
```

---

## Как проверить

Проверять пока нечего: проекта ещё нет, а сигнатуры без тела не скомпилируются как обычный `.ts`. На шаге 3:
- `npx tsc --noEmit` проверит, что типы согласованы и нет `any` и `as`;
- `npx vitest run src/features/cart` прогонит тесты по граничным случаям из шага 1 и проверку инварианта `total` на каждом кейсе;
- `expectTypeOf` из Vitest проверит на уровне типов, что `days: 3` и `{ kind: 'percent', amount: 100 }` не компилируются.

## Известные ограничения и решения на согласование

- **`Kopecks` — простой псевдоним `number`.** Компилятор не отличит копейки от рублей, защищают только именование и рантайм-проверки. Branded type с конструктором-предикатом возможен, но усложнит все места получения данных из API.
- **Ошибки бросаются как исключения, а не возвращаются в виде `Result`.** Некорректные входные данные здесь означают баг или испорченные данные, а не обычный пользовательский сценарий. Невалидный промокод отсекается раньше, на сервере.
- **Поле `lines` сверх запрошенной разбивки.** Оно нужно корзине для цены каждой строки и чтобы построчное округление было видно. Если не нужно, уберу.
- **Чего в выходе нет:** поля «сколько осталось до бесплатной доставки» для подсказки в UI. Его легко добавить в `OrderTotal`, если понадобится.
