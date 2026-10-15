# Тестирование системы правил

## Методика
Одна и та же задача дана Claude Code в двух чистых папках:
- **ДО** — папка без файла правил;
- **ПОСЛЕ** — папка с файлом правил `CLAUDE.md` ([rules.md](rules.md)).

Запуск в неинтерактивном режиме, ответы сохранены без правок ([raw/before.md](raw/before.md), [raw/after.md](raw/after.md)):

```bash
claude -p "Напиши React-компонент формы адреса доставки (улица, дом, квартира, телефон) с валидацией и кнопкой «Сохранить». Выведи код прямо в ответе, файлы не создавай."
```

## Вывод

| Критерий | ДО правил | ПОСЛЕ правил |
|---|---|---|
| План изменений перед кодом | нет | есть (5 пунктов) |
| Структура | 1 файл | 5 файлов по структуре `src/features/checkout/` |
| Валидация | внутри компонента | отдельный модуль `lib/validateAddress.ts`, тестируемый без React |
| Тесты | **0** | **12** (валидация + форма через React Testing Library) |
| Экспорт | `export default` | именованные экспорты, как требуют правила |
| Новые зависимости | — | явно перечислены и обоснованы |
| Раздел «Как проверить» и ограничения | нет | есть |
| Связь с архитектурой | — | форма не обращается к Supabase, данные через `onSubmit` и слой `api/` |

**Что конкретно улучшилось.** Без правил агент выдал работающий, но «одноразовый» компонент: всё в одном файле, без тестов и без учёта устройства проекта. С файлом правил тот же агент на тот же промпт выдал код, который можно сразу встраивать в проект: он разложен по принятой структуре фич, логика валидации отделена от UI и покрыта 12 тестами, соблюдены соглашения по экспортам и работе с данными.

Отдельно видно влияние правил формата вывода: ответ начинается с плана и заканчивается инструкцией по проверке и списком ограничений. Это экономит итерации: разработчик заранее понимает, что будет сделано, и знает, как проверить результат. Цена этого — ответ стал длиннее (580 строк против 320), но вся разница приходится на тесты и вынесенную логику, а не на «воду».

---

## Ответ агента ДО применения правил (без правок)

Ниже компонент на TypeScript без внешних библиотек. Ошибка поля показывается после того, как пользователь ушёл с него. При нажатии «Сохранить» проверяются все поля сразу. Телефон форматируется по мере ввода.

```tsx
import { useState, type ChangeEvent, type FocusEvent, type FormEvent } from "react";

export interface DeliveryAddress {
  street: string;
  house: string;
  apartment: string;
  phone: string; // нормализованный формат: +7XXXXXXXXXX
}

interface DeliveryAddressFormProps {
  initialValues?: Partial<DeliveryAddress>;
  onSave: (address: DeliveryAddress) => void | Promise<void>;
}

type FieldName = keyof DeliveryAddress;
type FormErrors = Partial<Record<FieldName, string>>;

const EMPTY_VALUES: DeliveryAddress = {
  street: "",
  house: "",
  apartment: "",
  phone: "",
};

// Оставляет только цифры и приводит номер к 10 цифрам без кода страны
function phoneDigits(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 11 && (digits[0] === "7" || digits[0] === "8")) {
    digits = digits.slice(1);
  } else if (digits.length > 10 && (digits[0] === "7" || digits[0] === "8")) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

// Форматирует ввод в виде +7 (XXX) XXX-XX-XX
function formatPhone(value: string): string {
  const d = phoneDigits(value);
  if (!d) return "";
  let result = "+7 (" + d.slice(0, 3);
  if (d.length >= 3) result += ")";
  if (d.length > 3) result += " " + d.slice(3, 6);
  if (d.length > 6) result += "-" + d.slice(6, 8);
  if (d.length > 8) result += "-" + d.slice(8, 10);
  return result;
}

function validateField(name: FieldName, value: string): string | undefined {
  const v = value.trim();

  switch (name) {
    case "street":
      if (!v) return "Укажите улицу";
      if (v.length < 2) return "Слишком короткое название улицы";
      if (v.length > 100) return "Не более 100 символов";
      if (!/^[\p{L}\d\s.,\-№()]+$/u.test(v)) return "Недопустимые символы в названии улицы";
      return undefined;

    case "house":
      if (!v) return "Укажите номер дома";
      // 12, 12А, 12/3, 12к1, 12 стр. 2
      if (!/^\d{1,4}[\p{L}]?(\s?(\/|к|корп\.?|стр\.?)\s?\d{1,3}[\p{L}]?)?$/iu.test(v)) {
        return "Некорректный номер дома (например: 12, 12А, 12/3, 12к1)";
      }
      return undefined;

    case "apartment":
      if (!v) return undefined; // необязательное поле (частный дом)
      if (!/^\d{1,5}[\p{L}]?$/u.test(v)) return "Номер квартиры: только цифры и, при необходимости, буква";
      if (parseInt(v, 10) === 0) return "Номер квартиры не может быть 0";
      return undefined;

    case "phone": {
      if (!v) return "Укажите телефон";
      const d = phoneDigits(v);
      if (d.length !== 10) return "Телефон должен содержать 10 цифр после +7";
      if (d[0] !== "9" && d[0] !== "3" && d[0] !== "4" && d[0] !== "8") {
        return "Некорректный код оператора или города";
      }
      return undefined;
    }
  }
}

function validateAll(values: DeliveryAddress): FormErrors {
  const errors: FormErrors = {};
  (Object.keys(values) as FieldName[]).forEach((name) => {
    const error = validateField(name, values[name]);
    if (error) errors[name] = error;
  });
  return errors;
}

export function DeliveryAddressForm({ initialValues, onSave }: DeliveryAddressFormProps) {
  const [values, setValues] = useState<DeliveryAddress>(() => ({
    ...EMPTY_VALUES,
    ...initialValues,
    phone: formatPhone(initialValues?.phone ?? ""),
  }));
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const name = e.target.name as FieldName;
    const value = name === "phone" ? formatPhone(e.target.value) : e.target.value;

    setValues((prev) => ({ ...prev, [name]: value }));
    setSaved(false);
    setSubmitError(null);

    // Перепроверяем на лету только поля, которые пользователь уже покинул
    if (touched[name]) {
      setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
    }
  };

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    const name = e.target.name as FieldName;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({ ...prev, [name]: validateField(name, values[name]) }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const validationErrors = validateAll(values);
    setErrors(validationErrors);
    setTouched({ street: true, house: true, apartment: true, phone: true });

    if (Object.keys(validationErrors).length > 0) {
      // Фокус на первое поле с ошибкой
      const firstInvalid = (Object.keys(validationErrors) as FieldName[])[0];
      document.getElementById(`delivery-${firstInvalid}`)?.focus();
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSave({
        street: values.street.trim(),
        house: values.house.trim(),
        apartment: values.apartment.trim(),
        phone: "+7" + phoneDigits(values.phone),
      });
      setSaved(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Не удалось сохранить адрес");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (
    name: FieldName,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
    required = true,
  ) => {
    const id = `delivery-${name}`;
    const error = touched[name] ? errors[name] : undefined;

    return (
      <div style={styles.field}>
        <label htmlFor={id} style={styles.label}>
          {label}
          {required && <span style={styles.required} aria-hidden="true"> *</span>}
        </label>
        <input
          id={id}
          name={name}
          value={values[name]}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-required={required}
          disabled={isSubmitting}
          style={{ ...styles.input, ...(error ? styles.inputError : null) }}
          {...props}
        />
        {error && (
          <span id={`${id}-error`} role="alert" style={styles.error}>
            {error}
          </span>
        )}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} noValidate style={styles.form}>
      <h2 style={styles.title}>Адрес доставки</h2>

      {renderField("street", "Улица", {
        placeholder: "ул. Ленина",
        autoComplete: "address-line1",
        maxLength: 100,
      })}

      <div style={styles.row}>
        {renderField("house", "Дом", {
          placeholder: "12к1",
          maxLength: 20,
        })}
        {renderField(
          "apartment",
          "Квартира",
          { placeholder: "45", inputMode: "numeric", autoComplete: "address-line2", maxLength: 6 },
          false,
        )}
      </div>

      {renderField("phone", "Телефон", {
        type: "tel",
        placeholder: "+7 (999) 123-45-67",
        autoComplete: "tel",
        inputMode: "tel",
      })}

      {submitError && (
        <div role="alert" style={styles.submitError}>
          {submitError}
        </div>
      )}
      {saved && (
        <div role="status" style={styles.success}>
          Адрес сохранён
        </div>
      )}

      <button type="submit" disabled={isSubmitting} style={styles.button}>
        {isSubmitting ? "Сохранение…" : "Сохранить"}
      </button>
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    maxWidth: 420,
    padding: 24,
    border: "1px solid #e0e0e0",
    borderRadius: 12,
    fontFamily: "system-ui, sans-serif",
  },
  title: { margin: 0, fontSize: 20 },
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  field: { display: "flex", flexDirection: "column", gap: 4 },
  label: { fontSize: 14, fontWeight: 500 },
  required: { color: "#d32f2f" },
  input: {
    padding: "10px 12px",
    fontSize: 15,
    border: "1px solid #bdbdbd",
    borderRadius: 8,
    outline: "none",
  },
  inputError: { borderColor: "#d32f2f", background: "#fff5f5" },
  error: { color: "#d32f2f", fontSize: 13 },
  submitError: { color: "#d32f2f", fontSize: 14 },
  success: { color: "#2e7d32", fontSize: 14 },
  button: {
    padding: "12px 16px",
    fontSize: 16,
    fontWeight: 600,
    color: "#fff",
    background: "#1976d2",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
  },
};

export default DeliveryAddressForm;
```

**Как использовать:**

```tsx
import DeliveryAddressForm from "./DeliveryAddressForm";

export default function CheckoutPage() {
  return (
    <DeliveryAddressForm
      initialValues={{ street: "ул. Ленина" }}
      onSave={async (address) => {
        const res = await fetch("/api/address", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(address),
        });
        if (!res.ok) throw new Error("Сервер вернул ошибку");
      }}
    />
  );
}
```

**Правила проверки:**
- **Улица:** обязательна, от 2 до 100 символов: буквы, цифры, пробелы и знаки `. , - № ( )`.
- **Дом:** обязателен. Подходят номера вида `12`, `12А`, `12/3`, `12к1`, `12 корп. 2`, `12 стр. 3`.
- **Квартира:** необязательна, потому что у частного дома её нет. Если указана, это цифры, после которых может стоять одна буква. Ноль не принимается.
- **Телефон:** обязателен, российский номер. Ввод через `8…` или `+7…` автоматически приводится к виду `+7 (XXX) XXX-XX-XX`. В `onSave` номер уходит в формате `+7XXXXXXXXXX`.

**Поведение формы:**
- Если `onSave` выбросит ошибку, её текст появится над кнопкой.
- Пока идёт сохранение, поля и кнопка заблокированы.
- Если при отправке есть ошибки, фокус переходит на первое неверное поле.

Если в проекте используется `react-hook-form` + `zod`, могу переписать форму на них: кода станет меньше, а схему проверки можно будет использовать и на сервере.


---

## Ответ агента ПОСЛЕ применения правил (без правок)

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
