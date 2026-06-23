import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { testApp } from '../test/app';
import { createTestUser, authHeader, createTestAccount, createTestCategory } from '../test/helpers';

describe('Transactions routes', () => {
  it('POST /api/transactions creates expense', async () => {
    const user = await createTestUser('txn@test.com', 'Txn User');
    const acc = await createTestAccount(user.id);
    const cat = await createTestCategory(user.id);

    const res = await request(testApp)
      .post('/api/transactions')
      .set(authHeader(user.id))
      .send({ type: 'expense', amount: 50, fromAccountId: acc.id, categoryId: cat.id });
    
    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(5000);
    expect(res.body.type).toBe('expense');
  });

  it('GET /api/transactions fetches list', async () => {
    const user = await createTestUser('txn2@test.com', 'Txn User 2');
    const res = await request(testApp)
      .get('/api/transactions')
      .set(authHeader(user.id));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
