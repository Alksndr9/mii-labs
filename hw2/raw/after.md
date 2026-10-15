План изменений:

1. `src/features/checkout/types.ts` содержит типы значений формы (`AddressFormValues`) и нормализованного адреса (`DeliveryAddress`).
2. `src/features/checkout/lib/validateAddress.ts` содержит валидацию без React: проверку отдельного поля, проверку всей формы и приведение телефона к формату `+7XXXXXXXXXX`. Так её легко тестировать отдельно.
3. `src/features/checkout/lib/validateAddress.test.ts` содержит тесты валидации и нормализации телефона.
4. `src/features/checkout/components/AddressForm.tsx` — сама форма. Ошибки показываются после ухода из поля и при отправке. При неудачной отправке фокус переходит на первое поле с ошибкой. Есть состояния «сохраняем», «успех» и «ошибка». Данные отправляются через проп `onSubmit`, поэтому компонент не обращается к Supabase напрямую.
5. `src/features/checkout/components/AddressForm.test.tsx` содержит тесты формы на React Testing Library.

Новые зависимости не нужны: валидация написана вручную, без zod и react-hook-form. В тестах используются `@testing-library/user-event` и `@testing-library/jest-dom`. Это стандартные дополнения к React Testing Library, которая уже есть в стеке. `user-event` воспроизводит ввод пользователя точнее, чем `fireEvent`. Если этих пакетов ещё нет, их нужно поставить как devDependencies.

---

### `src/features/checkout/types.ts`

```ts
export interface AddressFormValues {
  street: string;
  house: string;
  apartment: string;
  phone: string;
}

export type AddressField = keyof AddressFormValues;

export type AddressErrors = Partial<Record<AddressField, string>>;

export interface DeliveryAddress {
  street: string;
  house: string;
  apartment: string | null;
  /** Формат E.164: +7XXXXXXXXXX */
  phone: string;
}
```

### `src/features/checkout/lib/validateAddress.ts`

```ts
import type {
  AddressErrors,
  AddressField,
  AddressFormValues,
  DeliveryAddress,
} from '../types';

export const ADDRESS_FIELDS: readonly AddressField[] = ['street', 'house', 'apartment', 'phone'];

const STREET_MIN_LENGTH = 2;
const STREET_MAX_LENGTH = 100;
const HOUSE_MAX_LENGTH = 20;
// Номер дома начинается с цифры, дальше допускаются корпус/строение/дробь: «12к1», «5/2», «7 стр. 3»
const HOUSE_PATTERN = /^\d+[0-9a-zа-яё\s/.-]*$/i;
const APARTMENT_PATTERN = /^[0-9a-zа-яё-]{1,10}$/i;
const PHONE_ALLOWED_CHARS = /^\+?[\d\s()-]+$/;

export type AddressValidationResult =
  | { ok: true; address: DeliveryAddress }
  | { ok: false; errors: AddressErrors };

export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!PHONE_ALLOWED_CHARS.test(trimmed)) return null;

  const digits = trimmed.replace(/\D/g, '');
  const hasPlus = trimmed.startsWith('+');

  if (digits.length === 11 && digits.startsWith('7')) return `+${digits}`;
  // «8» и голые 10 цифр — привычные для пользователей варианты записи без кода страны
  if (!hasPlus && digits.length === 11 && digits.startsWith('8')) return `+7${digits.slice(1)}`;
  if (!hasPlus && digits.length === 10 && digits.startsWith('9')) return `+7${digits}`;

  return null;
}

export function validateField(field: AddressField, rawValue: string): string | undefined {
  const value = rawValue.trim();

  switch (field) {
    case 'street':
      if (!value) return 'Укажите улицу';
      if (value.length < STREET_MIN_LENGTH) return 'Название улицы слишком короткое';
      if (value.length > STREET_MAX_LENGTH) return `Не более ${STREET_MAX_LENGTH} символов`;
      return undefined;

    case 'house':
      if (!value) return 'Укажите номер дома';
      if (value.length > HOUSE_MAX_LENGTH) return `Не более ${HOUSE_MAX_LENGTH} символов`;
      if (!HOUSE_PATTERN.test(value)) return 'Номер дома должен начинаться с цифры, например 12к1 или 5/2';
      return undefined;

    case 'apartment':
      if (!value) return undefined;
      if (!APARTMENT_PATTERN.test(value)) return 'Только цифры и буквы, не более 10 символов';
      return undefined;

    case 'phone':
      if (!value) return 'Укажите телефон';
      if (normalizePhone(value) === null) return 'Введите российский номер, например +7 900 123-45-67';
      return undefined;

    default: {
      const exhaustiveCheck: never = field;
      return exhaustiveCheck;
    }
  }
}

export function validateAddress(values: AddressFormValues): AddressValidationResult {
  const errors: AddressErrors = {};

  for (const field of ADDRESS_FIELDS) {
    const message = validateField(field, values[field]);
    if (message) errors[field] = message;
  }

  const phone = normalizePhone(values.phone);
  if (Object.keys(errors).length > 0 || phone === null) {
    return { ok: false, errors };
  }

  const apartment = values.apartment.trim();

  return {
    ok: true,
    address: {
      street: values.street.trim(),
      house: values.house.trim(),
      apartment: apartment || null,
      phone,
    },
  };
}
```

### `src/features/checkout/lib/validateAddress.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { normalizePhone, validateAddress, validateField } from './validateAddress';

describe('normalizePhone', () => {
  it.each([
    ['+7 900 123-45-67', '+79001234567'],
    ['8 (900) 123-45-67', '+79001234567'],
    ['79001234567', '+79001234567'],
    ['9001234567', '+79001234567'],
    ['  +7(495)123-45-67  ', '+74951234567'],
  ])('нормализует %s → %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each([
    '',
    '12345',
    '+8 900 123-45-67',
    '+7 900 123-45-6',
    '+7 900 123-45-678',
    '+7 900 abc-45-67',
    '7+9001234567',
  ])('отклоняет %s', (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe('validateField', () => {
  it('требует улицу', () => {
    expect(validateField('street', '   ')).toBe('Укажите улицу');
    expect(validateField('street', 'Я')).toBe('Название улицы слишком короткое');
    expect(validateField('street', 'а'.repeat(101))).toBe('Не более 100 символов');
    expect(validateField('street', 'ул. Ленина')).toBeUndefined();
  });

  it.each(['12', '12к1', '5/2', '7 стр. 3', '10А'])('принимает номер дома %s', (house) => {
    expect(validateField('house', house)).toBeUndefined();
  });

  it.each(['', 'к1', 'дом'])('отклоняет номер дома «%s»', (house) => {
    expect(validateField('house', house)).toBeDefined();
  });

  it('квартира необязательна, но проверяется при заполнении', () => {
    expect(validateField('apartment', '')).toBeUndefined();
    expect(validateField('apartment', '42')).toBeUndefined();
    expect(validateField('apartment', '42Б')).toBeUndefined();
    expect(validateField('apartment', '42 / 1')).toBe('Только цифры и буквы, не более 10 символов');
    expect(validateField('apartment', '12345678901')).toBe('Только цифры и буквы, не более 10 символов');
  });

  it('проверяет телефон', () => {
    expect(validateField('phone', '')).toBe('Укажите телефон');
    expect(validateField('phone', '123')).toBe('Введите российский номер, например +7 900 123-45-67');
    expect(validateField('phone', '+7 900 123-45-67')).toBeUndefined();
  });
});

describe('validateAddress', () => {
  it('возвращает нормализованный адрес для валидных данных', () => {
    const result = validateAddress({
      street: '  ул. Ленина ',
      house: '12к1 ',
      apartment: '  ',
      phone: '8 (900) 123-45-67',
    });

    expect(result).toEqual({
      ok: true,
      address: { street: 'ул. Ленина', house: '12к1', apartment: null, phone: '+79001234567' },
    });
  });

  it('собирает ошибки по всем невалидным полям', () => {
    const result = validateAddress({ street: '', house: '', apartment: '', phone: '' });

    expect(result).toEqual({
      ok: false,
      errors: {
        street: 'Укажите улицу',
        house: 'Укажите номер дома',
        phone: 'Укажите телефон',
      },
    });
  });
});
```

### `src/features/checkout/components/AddressForm.tsx`

```tsx
import { useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ADDRESS_FIELDS, validateAddress, validateField } from '../lib/validateAddress';
import type { AddressErrors, AddressField, AddressFormValues, DeliveryAddress } from '../types';

interface FieldConfig {
  label: string;
  type: 'text' | 'tel';
  inputMode: 'text' | 'tel';
  autoComplete: string;
  required: boolean;
  placeholder?: string;
}

const FIELD_CONFIG: Record<AddressField, FieldConfig> = {
  street: {
    label: 'Улица',
    type: 'text',
    inputMode: 'text',
    autoComplete: 'address-line1',
    required: true,
    placeholder: 'ул. Ленина',
  },
  house: {
    label: 'Дом',
    type: 'text',
    inputMode: 'text',
    autoComplete: 'address-line2',
    required: true,
    placeholder: '12к1',
  },
  apartment: {
    label: 'Квартира',
    type: 'text',
    inputMode: 'text',
    autoComplete: 'address-line3',
    required: false,
  },
  phone: {
    label: 'Телефон',
    type: 'tel',
    inputMode: 'tel',
    autoComplete: 'tel',
    required: true,
    placeholder: '+7 900 123-45-67',
  },
};

const EMPTY_VALUES: AddressFormValues = { street: '', house: '', apartment: '', phone: '' };

type SubmitStatus = 'idle' | 'saving' | 'success' | 'error';

export interface AddressFormProps {
  initialValues?: Partial<AddressFormValues>;
  onSubmit: (address: DeliveryAddress) => Promise<void>;
}

export function AddressForm({ initialValues, onSubmit }: AddressFormProps) {
  const idPrefix = useId();
  const [values, setValues] = useState<AddressFormValues>({ ...EMPTY_VALUES, ...initialValues });
  const [errors, setErrors] = useState<AddressErrors>({});
  const [touched, setTouched] = useState<Partial<Record<AddressField, boolean>>>({});
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const inputRefs = useRef(new Map<AddressField, HTMLInputElement>());

  const isSaving = status === 'saving';

  function setFieldError(field: AddressField, value: string) {
    const message = validateField(field, value);
    setErrors((prev) => {
      const next = { ...prev };
      if (message) next[field] = message;
      else delete next[field];
      return next;
    });
  }

  function handleChange(field: AddressField) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;
      setValues((prev) => ({ ...prev, [field]: value }));
      if (status === 'success' || status === 'error') setStatus('idle');
      // До первого blur не ругаемся на каждый символ — только исправляем уже показанную ошибку
      if (touched[field]) setFieldError(field, value);
    };
  }

  function handleBlur(field: AddressField) {
    return () => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      setFieldError(field, values[field]);
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    const result = validateAddress(values);
    setTouched({ street: true, house: true, apartment: true, phone: true });

    if (!result.ok) {
      setErrors(result.errors);
      const firstInvalid = ADDRESS_FIELDS.find((field) => result.errors[field]);
      if (firstInvalid) inputRefs.current.get(firstInvalid)?.focus();
      return;
    }

    setErrors({});
    setStatus('saving');
    try {
      await onSubmit(result.address);
      setStatus('success');
    } catch {
      setStatus('error');
    }
  }

  return (
    <form
      noValidate
      aria-label="Адрес доставки"
      aria-busy={isSaving}
      onSubmit={(event) => void handleSubmit(event)}
      className="flex max-w-md flex-col gap-4"
    >
      {ADDRESS_FIELDS.map((field) => {
        const config = FIELD_CONFIG[field];
        const inputId = `${idPrefix}-${field}`;
        const errorId = `${inputId}-error`;
        const error = touched[field] ? errors[field] : undefined;

        return (
          <div key={field} className="flex flex-col gap-1">
            <label htmlFor={inputId} className="text-sm font-medium text-gray-900">
              {config.label}
              {config.required ? (
                <span aria-hidden="true" className="text-red-600">
                  {' '}
                  *
                </span>
              ) : (
                <span className="text-gray-500"> (необязательно)</span>
              )}
            </label>
            <input
              id={inputId}
              ref={(element) => {
                if (element) inputRefs.current.set(field, element);
                else inputRefs.current.delete(field);
              }}
              name={field}
              type={config.type}
              inputMode={config.inputMode}
              autoComplete={config.autoComplete}
              placeholder={config.placeholder}
              value={values[field]}
              onChange={handleChange(field)}
              onBlur={handleBlur(field)}
              disabled={isSaving}
              aria-required={config.required}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              className={`rounded-lg border px-3 py-2 text-base outline-none focus-visible:ring-2 disabled:bg-gray-100 ${
                error
                  ? 'border-red-600 focus-visible:ring-red-300'
                  : 'border-gray-300 focus-visible:ring-emerald-300'
              }`}
            />
            {error && (
              <p id={errorId} className="text-sm text-red-600">
                {error}
              </p>
            )}
          </div>
        );
      })}

      <button
        type="submit"
        disabled={isSaving}
        className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? 'Сохраняем…' : 'Сохранить'}
      </button>

      <p role="status" className="text-sm text-emerald-700">
        {status === 'success' ? 'Адрес сохранён' : ''}
      </p>
      {status === 'error' && (
        <p role="alert" className="text-sm text-red-600">
          Не удалось сохранить адрес. Попробуйте ещё раз.
        </p>
      )}
    </form>
  );
}
```

### `src/features/checkout/components/AddressForm.test.tsx`

```tsx
import { act, render, screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DeliveryAddress } from '../types';
import { AddressForm } from './AddressForm';

function createOnSubmit() {
  return vi.fn<(address: DeliveryAddress) => Promise<void>>().mockResolvedValue(undefined);
}

async function fillValidForm(user: UserEvent) {
  await user.type(screen.getByLabelText(/Улица/), 'ул. Ленина');
  await user.type(screen.getByLabelText(/Дом/), '12к1');
  await user.type(screen.getByLabelText(/Телефон/), '8 (900) 123-45-67');
}

describe('AddressForm', () => {
  it('рендерит все поля и кнопку «Сохранить»', () => {
    render(<AddressForm onSubmit={createOnSubmit()} />);

    expect(screen.getByLabelText(/Улица/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Дом/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Квартира/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Телефон/)).toHaveAttribute('type', 'tel');
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeEnabled();
  });

  it('при отправке пустой формы показывает ошибки и фокусирует первое невалидное поле', async () => {
    const user = userEvent.setup();
    const onSubmit = createOnSubmit();
    render(<AddressForm onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Укажите улицу')).toBeInTheDocument();
    expect(screen.getByText('Укажите номер дома')).toBeInTheDocument();
    expect(screen.getByText('Укажите телефон')).toBeInTheDocument();

    const street = screen.getByLabelText(/Улица/);
    expect(street).toHaveFocus();
    expect(street).toHaveAttribute('aria-invalid', 'true');
    expect(street).toHaveAccessibleDescription('Укажите улицу');
    expect(screen.getByLabelText(/Квартира/)).toHaveAttribute('aria-invalid', 'false');
  });

  it('показывает ошибку телефона после ухода из поля и убирает её при исправлении', async () => {
    const user = userEvent.setup();
    render(<AddressForm onSubmit={createOnSubmit()} />);

    const phone = screen.getByLabelText(/Телефон/);
    await user.type(phone, '123');
    expect(screen.queryByText(/Введите российский номер/)).not.toBeInTheDocument();

    await user.tab();
    expect(screen.getByText(/Введите российский номер/)).toBeInTheDocument();

    await user.clear(phone);
    await user.type(phone, '+7 900 123-45-67');
    expect(screen.queryByText(/Введите российский номер/)).not.toBeInTheDocument();
  });

  it('отправляет нормализованный адрес и сообщает об успехе', async () => {
    const user = userEvent.setup();
    const onSubmit = createOnSubmit();
    render(<AddressForm onSubmit={onSubmit} />);

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledWith({
      street: 'ул. Ленина',
      house: '12к1',
      apartment: null,
      phone: '+79001234567',
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Адрес сохранён');
  });

  it('блокирует форму во время сохранения', async () => {
    const user = userEvent.setup();
    let resolveSave: () => void = () => {};
    const onSubmit = vi.fn<(address: DeliveryAddress) => Promise<void>>(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    render(<AddressForm onSubmit={onSubmit} />);

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(screen.getByRole('button', { name: 'Сохраняем…' })).toBeDisabled();
    expect(screen.getByLabelText(/Улица/)).toBeDisabled();

    await act(async () => {
      resolveSave();
    });

    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeEnabled();
    expect(screen.getByRole('status')).toHaveTextContent('Адрес сохранён');
  });

  it('показывает ошибку, если сохранение не удалось, и позволяет повторить', async () => {
    const user = userEvent.setup();
    const onSubmit = createOnSubmit().mockRejectedValueOnce(new Error('network'));
    render(<AddressForm onSubmit={onSubmit} />);

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось сохранить адрес');

    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole('status')).toHaveTextContent('Адрес сохранён');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('подставляет начальные значения', () => {
    render(
      <AddressForm
        initialValues={{ street: 'ул. Мира', house: '5', phone: '+79001234567' }}
        onSubmit={createOnSubmit()}
      />,
    );

    expect(screen.getByLabelText(/Улица/)).toHaveValue('ул. Мира');
    expect(screen.getByLabelText(/Квартира/)).toHaveValue('');
  });
});
```

---

**Как проверить**

1. Сохраните файлы по указанным путям и запустите `npx vitest run src/features/checkout` и `npx tsc --noEmit`. Тесты я не запускал: вы просили не создавать файлы.
2. Чтобы проверить вручную, подключите форму на странице оформления заказа: `onSubmit` должен вызывать функцию из `src/features/checkout/api/`, например `saveDeliveryAddress(address)`, которая сохраняет адрес в Supabase.
   - Нажмите «Сохранить» на пустой форме: появятся ошибки, фокус перейдёт на поле «Улица».
   - Введите телефон `8 (900) 123-45-67`: в `onSubmit` придёт `+79001234567`.

**Известные ограничения**

- **Нет поля «Город».** Предполагается, что доставка идёт в один город. Если городов будет несколько, поле нужно добавить.
- **Нет подсказок адреса** (например, через DaData), поэтому существование улицы и дома не проверяется, только формат.
- **Нет маски ввода телефона.** Номер принимается в свободной форме и приводится к `+7XXXXXXXXXX` при сохранении. Принимаются только номера с кодом +7 (Россия и Казахстан).
- **Ошибки полей не объявляются экранной читалкой при вводе каждого символа.** Это сделано намеренно, чтобы не перегружать пользователя. Ошибка связана с полем через `aria-describedby` и зачитывается, когда на поле переходит фокус. Ошибка сохранения объявляется сразу через `role="alert"`.
- **Сохранение после закрытия формы не отменяется.** Если форму закрыть, пока адрес сохраняется, запрос всё равно завершится.
