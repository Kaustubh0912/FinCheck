import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { testApp } from '../test/app';
import { createTestUser, authHeader, createTestAccount, createTestCategory } from '../test/helpers';

describe('Accounts routes', () => {
  it('POST /api/accounts creates an account with opening balance', async () => {
    const user = await createTestUser('acc@test.com', 'Acc User');
    const res = await request(testApp)
      .post('/api/accounts')
      .set(authHeader(user.id))
      .send({ name: 'New Bank', type: 'bank', openingBalance: 500, color: '#111111', icon: 'bank' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('New Bank');
    expect(res.body.balance).toBe(50000);
  });

  it('POST /api/accounts rejects invalid input', async () => {
    const user = await createTestUser('acc_err@test.com', 'Acc Error');
    const res = await request(testApp)
      .post('/api/accounts')
      .set(authHeader(user.id))
      .send({ name: '', type: 'invalid_type' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('GET /api/accounts fetches accounts with balances', async () => {
    const user = await createTestUser('acc2@test.com', 'Acc User 2');
    await createTestAccount(user.id, { name: 'Bank 1' });
    const res = await request(testApp)
      .get('/api/accounts')
      .set(authHeader(user.id));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Bank 1');
  });

  it('PATCH /api/accounts/:id updates an existing account', async () => {
    const user = await createTestUser('acc_up@test.com', 'Acc Up User');
    const acc = await createTestAccount(user.id, { name: 'Old Name', balance: 10000 });
    const res = await request(testApp)
      .patch(`/api/accounts/${acc.id}`)
      .set(authHeader(user.id))
      .send({ name: 'Updated Name', color: '#222222', archived: true });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Name');
    expect(res.body.archived).toBe(true);
  });

  it('PATCH /api/accounts/:id rejects unauthorized access to another user account', async () => {
    const user1 = await createTestUser('acc_u1@test.com', 'Acc User 1');
    const user2 = await createTestUser('acc_u2@test.com', 'Acc User 2');
    const acc1 = await createTestAccount(user1.id, { name: 'User 1 Bank' });

    const res = await request(testApp)
      .patch(`/api/accounts/${acc1.id}`)
      .set(authHeader(user2.id))
      .send({ name: 'Hacked Name' });
    expect(res.status).toBe(404);
  });

  it('PATCH /api/accounts/reorder reorders multiple accounts', async () => {
    const user = await createTestUser('acc_reorder@test.com', 'Reorder User');
    const acc1 = await createTestAccount(user.id, { name: 'Bank A' });
    const acc2 = await createTestAccount(user.id, { name: 'Bank B' });

    const res = await request(testApp)
      .patch('/api/accounts/reorder')
      .set(authHeader(user.id))
      .send({
        updates: [
          { id: acc1.id, order: 2 },
          { id: acc2.id, order: 1 },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('DELETE /api/accounts/:id deletes empty account with 204', async () => {
    const user = await createTestUser('acc_del@test.com', 'Del User');
    const acc = await createTestAccount(user.id, { name: 'Temporary Account' });

    const res = await request(testApp)
      .delete(`/api/accounts/${acc.id}`)
      .set(authHeader(user.id));
    expect(res.status).toBe(204);
  });

  it('DELETE /api/accounts/:id returns 409 conflict when account has transactions', async () => {
    const user = await createTestUser('acc_conflict@test.com', 'Conflict User');
    const acc = await createTestAccount(user.id, { name: 'Active Bank' });
    const cat = await createTestCategory(user.id);

    // Create a transaction on this account
    await request(testApp)
      .post('/api/transactions')
      .set(authHeader(user.id))
      .send({
        type: 'expense',
        amount: 50,
        fromAccountId: acc.id,
        categoryId: cat.id,
        note: 'Coffee',
      });

    const res = await request(testApp)
      .delete(`/api/accounts/${acc.id}`)
      .set(authHeader(user.id));
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('transaction(s)');
  });
});
