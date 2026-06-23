import { describe, it, expect } from 'vitest';
import { parseSmartDate, toYmd } from './date';

describe('date utilities', () => {
  it('parseSmartDate parses "today"', () => {
    const base = new Date(2026, 5, 23, 12, 0, 0); // June 23, 2026
    const parsed = parseSmartDate('today', base);
    expect(parsed?.getTime()).toBe(base.getTime());
  });

  it('parseSmartDate parses exact date', () => {
    const base = new Date(2026, 5, 23, 12, 0, 0);
    const parsed = parseSmartDate('15.6.2026', base);
    expect(parsed?.getDate()).toBe(15);
    expect(parsed?.getMonth()).toBe(5); // June is 5
    expect(parsed?.getFullYear()).toBe(2026);
  });

  it('toYmd formats Date', () => {
    const date = new Date(2026, 5, 23);
    expect(toYmd(date)).toBe('2026-06-23');
  });
});
