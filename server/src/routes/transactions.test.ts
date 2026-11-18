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

  it('POST /api/transactions creates transfer between two accounts', async () => {
    const user = await createTestUser('txntrf@test.com', 'Trf User');
    const acc1 = await createTestAccount(user.id, { name: 'Bank 1', balance: 50000 });
    const acc2 = await createTestAccount(user.id, { name: 'Bank 2', balance: 10000 });

    const res = await request(testApp)
      .post('/api/transactions')
      .set(authHeader(user.id))
      .send({
        type: 'transfer',
        amount: 100,
        fromAccountId: acc1.id,
        toAccountId: acc2.id,
        note: 'Transfer to savings',
      });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('transfer');
    expect(res.body.amount).toBe(10000);
  });

  it('POST /api/transactions rejects transfer when source and destination are the same', async () => {
    const user = await createTestUser('txnsame@test.com', 'Same User');
    const acc = await createTestAccount(user.id);

    const res = await request(testApp)
      .post('/api/transactions')
      .set(authHeader(user.id))
      .send({
        type: 'transfer',
        amount: 50,
        fromAccountId: acc.id,
        toAccountId: acc.id,
      });
    expect(res.status).toBe(400);
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

    // Pagination batching and X-Total-Count header
    const res3 = await request(testApp)
      .get('/api/transactions?limit=1&skip=0')
      .set(authHeader(user.id));
    expect(res3.status).toBe(200);
    expect(res3.body.length).toBe(1);
    expect(res3.headers['x-total-count']).toBe('2');

    const res4 = await request(testApp)
      .get('/api/transactions?limit=1&skip=1')
      .set(authHeader(user.id));
    expect(res4.status).toBe(200);
    expect(res4.body.length).toBe(1);
    expect(res4.headers['x-total-count']).toBe('2');
    expect(res4.body[0].note).not.toBe(res3.body[0].note);
  });

  it('PATCH /api/transactions/:id updates a transaction', async () => {
    const user = await createTestUser('txn_patch@test.com', 'Patch User');
    const acc = await createTestAccount(user.id);
    const cat = await createTestCategory(user.id);

    const createRes = await request(testApp)
      .post('/api/transactions')
      .set(authHeader(user.id))
      .send({ type: 'expense', amount: 30, fromAccountId: acc.id, categoryId: cat.id, note: 'Initial Note' });
    expect(createRes.status).toBe(201);
    const txnId = createRes.body.id;

    const patchRes = await request(testApp)
      .patch(`/api/transactions/${txnId}`)
      .set(authHeader(user.id))
      .send({ note: 'Updated Note', amount: 45 });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.note).toBe('Updated Note');
    expect(patchRes.body.amount).toBe(4500);
  });

  it('DELETE /api/transactions/:id deletes a transaction with 204', async () => {
    const user = await createTestUser('txn_del@test.com', 'Delete User');
    const acc = await createTestAccount(user.id);

    const createRes = await request(testApp)
      .post('/api/transactions')
      .set(authHeader(user.id))
      .send({ type: 'expense', amount: 20, fromAccountId: acc.id, note: 'Temp' });
    expect(createRes.status).toBe(201);
    const txnId = createRes.body.id;

    const delRes = await request(testApp)
      .delete(`/api/transactions/${txnId}`)
      .set(authHeader(user.id));
    expect(delRes.status).toBe(204);

    // Verify it is gone
    const getRes = await request(testApp)
      .get('/api/transactions')
      .set(authHeader(user.id));
    expect(getRes.body.find((t: any) => t.id === txnId)).toBeUndefined();
  });
});
