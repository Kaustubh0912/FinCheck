import { describe, it, expect } from 'vitest';
import { friendlyDate, parseSmartDate, parseSmartRange, rangeLabel, toYmd } from './date';

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

  it.each([
    ['t', 23],
    ['yesterday', 22],
    ['tmr', 24],
  ])('parseSmartDate handles relative date %s', (input, day) => {
    const base = new Date(2026, 5, 23, 18, 30, 0);
    const parsed = parseSmartDate(input, base);
    expect(parsed && toYmd(parsed)).toBe(`2026-06-${day}`);
    expect(parsed?.getHours()).toBe(12);
  });

  it('parseSmartDate supports month names, two-digit years, and invalid dates', () => {
    const base = new Date(2026, 5, 23, 12, 0, 0);
    expect(toYmd(parseSmartDate('15', base)!)).toBe('2026-06-15');
    expect(toYmd(parseSmartDate('1 jan 26', base)!)).toBe('2026-01-01');
    expect(toYmd(parseSmartDate('February 28', base)!)).toBe('2026-02-28');
    expect(parseSmartDate('31.2.2026', base)).toBeNull();
    expect(parseSmartDate('not a date', base)).toBeNull();
  });

  it('parseSmartRange returns whole-day boundaries and swaps reversed dates', () => {
    const base = new Date(2026, 5, 23, 12, 0, 0);
    const range = parseSmartRange('25.6..23.6', base);
    expect(range?.from).toEqual(new Date(2026, 5, 23, 0, 0, 0, 0));
    expect(range?.to).toEqual(new Date(2026, 5, 25, 23, 59, 59, 999));
    expect(parseSmartRange('..today', base)).toBeNull();
  });

  it('toYmd formats Date', () => {
    const date = new Date(2026, 5, 23);
    expect(toYmd(date)).toBe('2026-06-23');
  });

  it('formats friendly dates and range labels', () => {
    expect(friendlyDate('2026-06-23')).toBe('23 Jun 2026');
    expect(friendlyDate('2026-06-23', true)).toBe('Tue, 23 Jun 2026');
    expect(friendlyDate('invalid')).toBe('invalid');
    expect(rangeLabel(new Date(2026, 5, 23), new Date(2026, 5, 23))).toBe('23 Jun 2026');
    expect(rangeLabel(new Date(2026, 5, 23), new Date(2026, 5, 24))).toBe('23 Jun 2026 \u2013 24 Jun 2026');
  });
});
