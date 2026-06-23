import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { testApp } from '../test/app';
import { createTestUser, authHeader, createTestCategory } from '../test/helpers';

describe('Categories routes', () => {
  it('POST /api/categories', async () => {
    const user = await createTestUser('cat@test.com', 'Cat User');
    const res = await request(testApp)
      .post('/api/categories')
      .set(authHeader(user.id))
      .send({ name: 'Food', kind: 'expense', color: '#ff0000', icon: 'food' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Food');
  });

  it('GET /api/categories', async () => {
    const user = await createTestUser('cat2@test.com', 'Cat User 2');
    await createTestCategory(user.id, { name: 'Rent' });
    const res = await request(testApp)
      .get('/api/categories')
      .set(authHeader(user.id));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Rent');
  });
});
