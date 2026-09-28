import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { registerTestUser } from './helpers';
import { app } from './testApp';

describe('Payments (mock Pix)', () => {
  it('incrementa o saldo de creditos e registra a transacao ao confirmar o pagamento simulado', async () => {
    const { token, user } = await registerTestUser();

    const res = await request(app)
      .post('/payments/mock-pix')
      .set('Authorization', `Bearer ${token}`)
      .send({ creditsAmount: 10, amountFiat: 20 });

    expect(res.status).toBe(200);
    expect(res.body.balance).toBe(10);

    const transactions = await prisma.transaction.findMany({ where: { userId: user.id } });
    expect(transactions).toHaveLength(1);
    expect(transactions[0].type).toBe('PURCHASE_CREDITS');
    expect(transactions[0].amountCredits).toBe(10);
  });

  it('acumula saldo em compras sucessivas', async () => {
    const { token, user } = await registerTestUser();

    await request(app).post('/payments/mock-pix').set('Authorization', `Bearer ${token}`).send({ creditsAmount: 5, amountFiat: 10 });
    const second = await request(app)
      .post('/payments/mock-pix')
      .set('Authorization', `Bearer ${token}`)
      .send({ creditsAmount: 3, amountFiat: 6 });

    expect(second.body.balance).toBe(8);

    const credit = await prisma.userCredit.findUnique({ where: { userId: user.id } });
    expect(credit?.balance).toBe(8);
  });
});
