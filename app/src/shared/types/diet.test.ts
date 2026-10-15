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
