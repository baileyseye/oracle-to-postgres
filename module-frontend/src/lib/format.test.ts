import { describe, expect, it } from 'vitest';
import { formatCount } from './format';

describe('formatCount', () => {
  it('groups thousands with non-breaking spaces', () => {
    expect(formatCount(5000)).toBe('5\u00A0000');
    expect(formatCount(1234567)).toBe('1\u00A0234\u00A0567');
  });

  it('keeps three-digit and smaller values unchanged', () => {
    expect(formatCount(10)).toBe('10');
    expect(formatCount(999)).toBe('999');
  });

  it('truncates fractions and handles negative values', () => {
    expect(formatCount(12.9)).toBe('12');
    expect(formatCount(-1500)).toBe('-1\u00A0500');
  });
});
