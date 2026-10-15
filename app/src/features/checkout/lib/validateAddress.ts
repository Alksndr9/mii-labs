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
