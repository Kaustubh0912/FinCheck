import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { testApp } from '../test/app';
import { createTestUser, authHeader, createTestAccount } from '../test/helpers';

describe('Accounts routes', () => {
  it('POST /api/accounts', async () => {
    const user = await createTestUser('acc@test.com', 'Acc User');
    const res = await request(testApp)
      .post('/api/accounts')
      .set(authHeader(user.id))
      .send({ name: 'New Bank', type: 'bank', openingBalance: 500, color: '#111111', icon: 'bank' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('New Bank');
    expect(res.body.balance).toBe(50000);
  });

  it('GET /api/accounts', async () => {
    const user = await createTestUser('acc2@test.com', 'Acc User 2');
    await createTestAccount(user.id, { name: 'Bank 1' });
    const res = await request(testApp)
      .get('/api/accounts')
      .set(authHeader(user.id));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Bank 1');
  });
});
