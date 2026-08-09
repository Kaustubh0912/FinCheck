import { describe, it, expect } from 'vitest';
import { currencySymbol, dayKey, formatDayHeading, formatMoney, monthLabel, monthRange } from './format';

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

  it('formatMoney supports other currencies and unknown currency fallbacks', () => {
    expect(formatMoney(12345, 'EUR')).toContain('123,45');
    expect(formatMoney(12345, 'GBP')).toContain('123.45');
    expect(formatMoney(12345, 'ZZZ')).toContain('123.45');
  });

  it('currencySymbol returns correct symbol', () => {
    expect(currencySymbol('INR')).toBe('₹');
    expect(currencySymbol('USD')).toBe('$');
  });

  it('dayKey formats YYYY-MM-DD', () => {
    expect(dayKey('2026-06-23T12:00:00Z')).toBe('2026-06-23');
  });

  it('formats month ranges and labels from a supplied date', () => {
    const date = new Date(2026, 1, 15, 12, 0, 0);
    const range = monthRange(date);
    expect(range.from).toBe(new Date(2026, 1, 1).toISOString());
    expect(range.to).toBe(new Date(2026, 2, 0, 23, 59, 59).toISOString());
    expect(monthLabel(date)).toMatch(/February 2026/);
  });

  it('labels today and yesterday', () => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    expect(formatDayHeading(today.toISOString())).toBe('Today');
    expect(formatDayHeading(yesterday.toISOString())).toBe('Yesterday');
  });
});
