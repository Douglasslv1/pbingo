import request from 'supertest';
import { prisma } from '../src/lib/prisma';
import { app } from './testApp';

let userCounter = 0;

export async function registerTestUser(overrides: Partial<{ name: string; email: string; password: string }> = {}) {
  userCounter += 1;
  const payload = {
    name: overrides.name ?? `Usuario ${userCounter}`,
    email: overrides.email ?? `usuario${userCounter}@example.com`,
    password: overrides.password ?? 'senha1234',
  };

  const res = await request(app).post('/auth/register').send(payload);
  return { token: res.body.token as string, user: res.body.user as { id: string; name: string; email: string } };
}

export function createWaitingRound() {
  return prisma.round.create({ data: { status: 'WAITING' } });
}

export function setCreditBalance(userId: string, balance: number) {
  return prisma.userCredit.update({ where: { userId }, data: { balance } });
}

export function setPrizeBalance(userId: string, balanceFiat: number) {
  return prisma.userPrize.update({ where: { userId }, data: { balanceFiat } });
}
