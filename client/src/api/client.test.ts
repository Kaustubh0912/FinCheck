import { describe, it, expect } from 'vitest';
import { errMessage } from './client';

describe('client utilities', () => {
  it('errMessage extracts from Error', () => {
    const err = new Error('Test error');
    expect(errMessage(err)).toBe('Test error');
  });

  it('errMessage returns fallback for unknown', () => {
    expect(errMessage(null)).toBe('Something went wrong');
  });
});
