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
    expect(res.body.settled).toBe(false);
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

  it('POST /api/splits rejects when myShare is greater than totalAmount', async () => {
    const user = await createTestUser('split_inv@test.com', 'Split Invalid');
    const acc = await createTestAccount(user.id);

    const res = await request(testApp)
      .post('/api/splits')
      .set(authHeader(user.id))
      .send({ totalAmount: 50, myShare: 60, fromAccountId: acc.id });
    expect(res.status).toBe(400);
  });

  it('GET /api/splits lists splits with settled filter', async () => {
    const user = await createTestUser('split_list@test.com', 'Split List User');
    const acc = await createTestAccount(user.id);

    // Create an unsettled split
    await request(testApp)
      .post('/api/splits')
      .set(authHeader(user.id))
      .send({ totalAmount: 100, myShare: 50, fromAccountId: acc.id });

    // Create an auto-settled split (myShare === totalAmount)
    await request(testApp)
      .post('/api/splits')
      .set(authHeader(user.id))
      .send({ totalAmount: 80, myShare: 80, fromAccountId: acc.id });

    const allRes = await request(testApp)
      .get('/api/splits')
      .set(authHeader(user.id));
    expect(allRes.status).toBe(200);
    expect(allRes.body.length).toBe(2);

    const unsettledRes = await request(testApp)
      .get('/api/splits?settled=false')
      .set(authHeader(user.id));
    expect(unsettledRes.status).toBe(200);
    expect(unsettledRes.body.length).toBe(1);
    expect(unsettledRes.body[0].settled).toBe(false);
  });

  it('POST /api/splits/:id/repay settles owed amount and logs reimbursement transaction', async () => {
    const user = await createTestUser('split_repay@test.com', 'Split Repay User');
    const acc = await createTestAccount(user.id);

    // Create split: total 100, my share 40 => 60 owed
    const createRes = await request(testApp)
      .post('/api/splits')
      .set(authHeader(user.id))
      .send({ totalAmount: 100, myShare: 40, fromAccountId: acc.id });
    expect(createRes.status).toBe(201);
    const splitId = createRes.body.id;

    // Repay partial: 30
    const repay1 = await request(testApp)
      .post(`/api/splits/${splitId}/repay`)
      .set(authHeader(user.id))
      .send({ amount: 30, toAccountId: acc.id });
    expect(repay1.status).toBe(200);
    expect(repay1.body.settledAmount).toBe(3000);
    expect(repay1.body.settled).toBe(false);

    // Repay remainder: 30
    const repay2 = await request(testApp)
      .post(`/api/splits/${splitId}/repay`)
      .set(authHeader(user.id))
      .send({ amount: 30, toAccountId: acc.id });
    expect(repay2.status).toBe(200);
    expect(repay2.body.settledAmount).toBe(6000);
    expect(repay2.body.settled).toBe(true);

    // Further repayment attempts are rejected with 400
    const repay3 = await request(testApp)
      .post(`/api/splits/${splitId}/repay`)
      .set(authHeader(user.id))
      .send({ amount: 10, toAccountId: acc.id });
    expect(repay3.status).toBe(400);
    expect(repay3.body.error).toContain('already fully settled');
  });
});
