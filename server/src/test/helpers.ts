import request from 'supertest';
import { testApp } from './app';
import { User, Account, Category } from '../db';
import { signToken } from '../auth/middleware';

export async function createTestUser(email: string, name: string) {
  const user = await User.create({
    email,
    name,
    passwordHash: 'dummyhash',
    currency: 'INR',
    monthlyBudget: 5000000,
    tokenVersion: 0,
  });
  return user;
}

export function authHeader(userId: string, tokenVersion = 0) {
  return { Authorization: `Bearer ${signToken(userId, tokenVersion)}` };
}

export async function createTestAccount(userId: string, overrides = {}) {
  const account = await Account.create({
    userId,
    name: 'Test Account',
    type: 'bank',
    openingBalance: 100000,
    ...overrides,
  });
  return account;
}

export async function createTestCategory(userId: string, overrides = {}) {
  const category = await Category.create({
    userId,
    name: 'Test Category',
    kind: 'expense',
    ...overrides,
  });
  return category;
}
