import { describe, it, expect } from 'vitest';
import { formatMoney, currencySymbol, dayKey } from './format';

describe('format utilities', () => {
  it('formatMoney formats INR', () => {
    // formatMoney returns non-breaking spaces or regular spaces depending on locale implementation in Node.js
    // So we use string matching to be safe
    const res = formatMoney(10000, 'INR');
    expect(res).toContain('₹');
    expect(res).toContain('100');
  });

  it('formatMoney formats USD', () => {
    const res = formatMoney(10000, 'USD');
    expect(res).toContain('$');
    expect(res).toContain('100');
  });

  it('currencySymbol returns correct symbol', () => {
    expect(currencySymbol('INR')).toBe('₹');
    expect(currencySymbol('USD')).toBe('$');
  });

  it('dayKey formats YYYY-MM-DD', () => {
    expect(dayKey('2026-06-23T12:00:00Z')).toBe('2026-06-23');
  });
});
