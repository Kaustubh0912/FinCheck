import { describe, it, expect } from 'vitest';
import { toMinor, registerSchema, transactionSchema, createSplitSchema } from './validate';

describe('validate utilities', () => {
  it('toMinor converts properly', () => {
    expect(toMinor(10)).toBe(1000);
    expect(toMinor(10.55)).toBe(1055);
  });

  it('registerSchema rejects bad passwords', () => {
    const res = registerSchema.safeParse({ email: 'test@test.com', name: 'Test', password: 'password', currency: 'INR' });
    expect(res.success).toBe(false);
  });

  it('transactionSchema validates type requirements', () => {
    const incomeNoTo = transactionSchema.safeParse({ type: 'income', amount: 100 });
    expect(incomeNoTo.success).toBe(false);
    
    const expenseNoFrom = transactionSchema.safeParse({ type: 'expense', amount: 100 });
    expect(expenseNoFrom.success).toBe(false);

    const transferSameAcc = transactionSchema.safeParse({ type: 'transfer', amount: 100, fromAccountId: 'a', toAccountId: 'a' });
    expect(transferSameAcc.success).toBe(false);
  });

  it('createSplitSchema allows myShare to be 0', () => {
    const validZeroShare = createSplitSchema.safeParse({ totalAmount: 100, myShare: 0, fromAccountId: 'acc123' });
    expect(validZeroShare.success).toBe(true);

    const invalidNegativeShare = createSplitSchema.safeParse({ totalAmount: 100, myShare: -5, fromAccountId: 'acc123' });
    expect(invalidNegativeShare.success).toBe(false);
  });
});
