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
