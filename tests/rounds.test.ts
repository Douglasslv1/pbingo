import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { createWaitingRound, registerTestUser, setCreditBalance } from './helpers';
import { app } from './testApp';

describe('Rounds', () => {
  it('rejeita entrada quando nao ha rodada aberta (WAITING)', async () => {
    const { token, user } = await registerTestUser();
    await setCreditBalance(user.id, 5);

    const res = await request(app).post('/rounds/join').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
  });

  it('rejeita entrada quando o usuario nao tem chaves suficientes', async () => {
    const { token, user } = await registerTestUser();
    await createWaitingRound();
    await setCreditBalance(user.id, 0);

    const res = await request(app).post('/rounds/join').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('compra uma cartela, debita 1 chave e acumula o premio da rodada descontada a comissao da casa', async () => {
    const { token, user } = await registerTestUser();
    const round = await createWaitingRound();
    await setCreditBalance(user.id, 3);

    const res = await request(app).post('/rounds/join').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(201);
    expect(res.body.roundId).toBe(round.id);
    expect(res.body.numbersMatrix).toHaveLength(5);
    expect(res.body.accumulatedPrize).toBe('0.8');

    const credit = await prisma.userCredit.findUnique({ where: { userId: user.id } });
    expect(credit?.balance).toBe(2);

    const tickets = await prisma.ticket.count({ where: { userId: user.id, roundId: round.id } });
    expect(tickets).toBe(1);
  });

  it('nunca permite saldo de creditos negativo sob concorrencia (duas compras simultaneas com apenas 1 chave)', async () => {
    const { token, user } = await registerTestUser();
    await createWaitingRound();
    await setCreditBalance(user.id, 1);

    const [r1, r2] = await Promise.all([
      request(app).post('/rounds/join').set('Authorization', `Bearer ${token}`),
      request(app).post('/rounds/join').set('Authorization', `Bearer ${token}`),
    ]);

    const statuses = [r1.status, r2.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 400]);

    const credit = await prisma.userCredit.findUnique({ where: { userId: user.id } });
    expect(credit?.balance).toBe(0);

    const ticketsCount = await prisma.ticket.count({ where: { userId: user.id } });
    expect(ticketsCount).toBe(1);
  });

  it('a constraint de banco impede saldo de creditos negativo mesmo via SQL direto', async () => {
    const { user } = await registerTestUser();
    await setCreditBalance(user.id, 0);

    await expect(
      prisma.$executeRaw`UPDATE user_credits SET balance = balance - 1 WHERE user_id = ${user.id}::uuid`,
    ).rejects.toThrow();
  });
});
