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
