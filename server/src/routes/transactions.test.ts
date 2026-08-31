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

  it('GET /api/transactions filters by q, amountMin, amountMax', async () => {
    const user = await createTestUser('txnsearch@test.com', 'Search User');
    const acc = await createTestAccount(user.id);
    const cat = await createTestCategory(user.id);

    await request(testApp)
      .post('/api/transactions')
      .set(authHeader(user.id))
      .send({ type: 'expense', amount: 50, note: 'Starbucks Coffee', fromAccountId: acc.id, categoryId: cat.id });

    await request(testApp)
      .post('/api/transactions')
      .set(authHeader(user.id))
      .send({ type: 'expense', amount: 500, note: 'Supermarket Grocery', fromAccountId: acc.id, categoryId: cat.id });

    // Search by q
    const res1 = await request(testApp)
      .get('/api/transactions?q=coffee')
      .set(authHeader(user.id));
    expect(res1.status).toBe(200);
    expect(res1.body.length).toBe(1);
    expect(res1.body[0].note).toBe('Starbucks Coffee');

    // Filter by amountMin & amountMax (in minor units: 5000 is 50, 50000 is 500)
    const res2 = await request(testApp)
      .get('/api/transactions?amountMin=10000&amountMax=60000')
      .set(authHeader(user.id));
    expect(res2.status).toBe(200);
    expect(res2.body.length).toBe(1);
    expect(res2.body[0].note).toBe('Supermarket Grocery');
  });
});
