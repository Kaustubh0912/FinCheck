import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { testApp } from '../test/app';
import { createTestUser, authHeader, createTestCategory, createTestAccount } from '../test/helpers';

describe('Categories routes', () => {
  it('POST /api/categories creates a new category', async () => {
    const user = await createTestUser('cat@test.com', 'Cat User');
    const res = await request(testApp)
      .post('/api/categories')
      .set(authHeader(user.id))
      .send({ name: 'Food', kind: 'expense', color: '#ff0000', icon: 'food' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Food');
    expect(res.body.kind).toBe('expense');
  });

  it('POST /api/categories rejects invalid input', async () => {
    const user = await createTestUser('cat_err@test.com', 'Cat Err User');
    const res = await request(testApp)
      .post('/api/categories')
      .set(authHeader(user.id))
      .send({ name: '', kind: 'invalid_kind' });
    expect(res.status).toBe(400);
  });

  it('GET /api/categories returns user categories', async () => {
    const user = await createTestUser('cat2@test.com', 'Cat User 2');
    await createTestCategory(user.id, { name: 'Rent' });
    const res = await request(testApp)
      .get('/api/categories')
      .set(authHeader(user.id));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Rent');
  });

  it('PATCH /api/categories/:id updates category details', async () => {
    const user = await createTestUser('cat_patch@test.com', 'Cat Patch User');
    const cat = await createTestCategory(user.id, { name: 'Old Groceries', color: '#00ff00' });
    const res = await request(testApp)
      .patch(`/api/categories/${cat.id}`)
      .set(authHeader(user.id))
      .send({ name: 'Supermarket', color: '#112233' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Supermarket');
    expect(res.body.color).toBe('#112233');
  });

  it('PATCH /api/categories/:id returns 404 for category owned by another user', async () => {
    const user1 = await createTestUser('cat_u1@test.com', 'Cat User 1');
    const user2 = await createTestUser('cat_u2@test.com', 'Cat User 2');
    const cat1 = await createTestCategory(user1.id, { name: 'Personal Cat' });

    const res = await request(testApp)
      .patch(`/api/categories/${cat1.id}`)
      .set(authHeader(user2.id))
      .send({ name: 'Hacked Cat' });
    expect(res.status).toBe(404);
  });

  it('DELETE /api/categories/:id deletes category and updates transactions', async () => {
    const user = await createTestUser('cat_del@test.com', 'Cat Del User');
    const cat = await createTestCategory(user.id, { name: 'To Delete' });
    const acc = await createTestAccount(user.id);

    // Create a transaction associated with this category
    const txnRes = await request(testApp)
      .post('/api/transactions')
      .set(authHeader(user.id))
      .send({
        type: 'expense',
        amount: 25,
        fromAccountId: acc.id,
        categoryId: cat.id,
        note: 'Categorized Expense',
      });
    expect(txnRes.status).toBe(201);

    const delRes = await request(testApp)
      .delete(`/api/categories/${cat.id}`)
      .set(authHeader(user.id));
    expect(delRes.status).toBe(204);

    // Verify categoryId is cleared on the transaction
    const txnsRes = await request(testApp)
      .get('/api/transactions')
      .set(authHeader(user.id));
    expect(txnsRes.status).toBe(200);
    const txn = txnsRes.body.find((t: any) => t.id === txnRes.body.id);
    expect(txn?.categoryId).toBeFalsy();
  });
});
