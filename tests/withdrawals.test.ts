import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { registerTestUser, setPrizeBalance } from './helpers';
import { app } from './testApp';

describe('Withdrawals', () => {
  it('permite sacar quando ha saldo sacavel suficiente', async () => {
    const { token, user } = await registerTestUser();
    await setPrizeBalance(user.id, 5);

    const res = await request(app).post('/withdrawals').set('Authorization', `Bearer ${token}`).send({ amount: 3 });

    expect(res.status).toBe(201);
    expect(res.body.remainingBalance).toBe('2');

    const transaction = await prisma.transaction.findFirst({ where: { userId: user.id, type: 'WITHDRAWAL' } });
    expect(transaction?.status).toBe('PENDING');
  });

  it('rejeita saque quando o saldo sacavel e insuficiente', async () => {
    const { token, user } = await registerTestUser();
    await setPrizeBalance(user.id, 5);

    const res = await request(app).post('/withdrawals').set('Authorization', `Bearer ${token}`).send({ amount: 100 });

    expect(res.status).toBe(400);

    const prize = await prisma.userPrize.findUnique({ where: { userId: user.id } });
    expect(prize?.balanceFiat.toString()).toBe('5');
  });

  it('nunca permite saldo de premios negativo sob concorrencia (dois saques simultaneos do mesmo saldo total)', async () => {
    const { token, user } = await registerTestUser();
    await setPrizeBalance(user.id, 10);

    const [r1, r2] = await Promise.all([
      request(app).post('/withdrawals').set('Authorization', `Bearer ${token}`).send({ amount: 10 }),
      request(app).post('/withdrawals').set('Authorization', `Bearer ${token}`).send({ amount: 10 }),
    ]);

    const statuses = [r1.status, r2.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 400]);

    const prize = await prisma.userPrize.findUnique({ where: { userId: user.id } });
    expect(Number(prize?.balanceFiat)).toBe(0);
  });
});
