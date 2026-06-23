import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { testApp } from '../test/app';
import { createTestUser, authHeader, createTestAccount } from '../test/helpers';

describe('Summary routes', () => {
  it('GET /api/summary returns correct aggregations', async () => {
    const user = await createTestUser('sum@test.com', 'Sum User');
    await createTestAccount(user.id, { openingBalance: 100000 }); // 1000 INR
    
    const res = await request(testApp)
      .get('/api/summary')
      .set(authHeader(user.id));
      
    expect(res.status).toBe(200);
    expect(res.body.netWorth).toBe(100000);
    expect(res.body.income).toBe(0);
    expect(res.body.expense).toBe(0);
    expect(Array.isArray(res.body.accounts)).toBe(true);
  });
});
