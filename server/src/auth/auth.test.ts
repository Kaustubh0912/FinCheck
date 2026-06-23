import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { testApp } from '../test/app';
import { createTestUser, authHeader } from '../test/helpers';

describe('Auth routes', () => {
  it('POST /api/auth/register', async () => {
    const res = await request(testApp)
      .post('/api/auth/register')
      .send({ email: 'new@test.com', name: 'New User', password: 'password1' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('new@test.com');
  });

  it('GET /api/auth/me', async () => {
    const user = await createTestUser('me@test.com', 'Me User');
    const res = await request(testApp)
      .get('/api/auth/me')
      .set(authHeader(user.id));
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me@test.com');
  });
});
