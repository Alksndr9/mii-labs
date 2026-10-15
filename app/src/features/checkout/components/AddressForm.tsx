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
