import { describe, it, expect } from 'vitest';
import { resolveThemeColor } from './colors';

describe('colors utilities', () => {
  it('resolveThemeColor resolves known hex to variable', () => {
    expect(resolveThemeColor('#6366f1')).toBe('var(--cat-indigo)');
  });

  it('resolveThemeColor falls back for unknown hex', () => {
    expect(resolveThemeColor('#123456')).toBe('#123456');
  });

  it('resolveThemeColor returns default when null', () => {
    expect(resolveThemeColor(null)).toBe('var(--cat-slate)');
  });
});
