import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { testApp } from '../test/app';
import { createTestUser, authHeader, createTestAccount, createTestCategory } from '../test/helpers';

describe('Splits routes', () => {
  it('POST /api/splits creates a split and transaction', async () => {
    const user = await createTestUser('split@test.com', 'Split User');
    const acc = await createTestAccount(user.id);
    const cat = await createTestCategory(user.id);

    const res = await request(testApp)
      .post('/api/splits')
      .set(authHeader(user.id))
      .send({ totalAmount: 100, myShare: 40, fromAccountId: acc.id, categoryId: cat.id });
    
    expect(res.status).toBe(201);
    expect(res.body.totalAmount).toBe(10000);
    expect(res.body.myShare).toBe(4000);
  });

  it('POST /api/splits allows myShare to be 0', async () => {
    const user = await createTestUser('split0@test.com', 'Split Zero User');
    const acc = await createTestAccount(user.id);
    const cat = await createTestCategory(user.id);

    const res = await request(testApp)
      .post('/api/splits')
      .set(authHeader(user.id))
      .send({ totalAmount: 50, myShare: 0, fromAccountId: acc.id, categoryId: cat.id });
    
    expect(res.status).toBe(201);
    expect(res.body.totalAmount).toBe(5000);
    expect(res.body.myShare).toBe(0);
  });
});
