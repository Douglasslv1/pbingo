import { Prisma } from '@prisma/client';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { generateBingoMatrix } from '../src/modules/rounds/ticket.util';
import { registerTestUser } from './helpers';
import { app } from './testApp';

function createTransaction(userId: string, data: Partial<Prisma.TransactionUncheckedCreateInput>, createdAt: Date) {
  return prisma.transaction.create({
    data: { userId, type: 'SPEND_KEY', amountCredits: 1, status: 'COMPLETED', createdAt, ...data },
  });
}

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60_000);
}

describe('Historico de transacoes', () => {
  it('lista do mais recente para o mais antigo, sem cobrancas Pix nao pagas nem transacoes de outros', async () => {
    const { token, user } = await registerTestUser();
    const other = await registerTestUser();
    await createTransaction(user.id, { type: 'PURCHASE_CREDITS', amountCredits: 10, amountFiat: 10 }, minutesAgo(30));
    await createTransaction(user.id, { type: 'PURCHASE_CREDITS', amountCredits: 5, status: 'PENDING' }, minutesAgo(20));
    await createTransaction(user.id, { type: 'PURCHASE_CREDITS', amountCredits: 5, status: 'FAILED' }, minutesAgo(15));
    await createTransaction(user.id, { type: 'SPEND_KEY' }, minutesAgo(10));
    await createTransaction(user.id, { type: 'WITHDRAWAL', amountFiat: 12.5, amountCredits: 0, status: 'PENDING' }, minutesAgo(5));
    await createTransaction(other.user.id, { type: 'SPEND_KEY' }, minutesAgo(1));

    const res = await request(app).get('/wallet/transactions').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.items.map((t: { type: string; status: string }) => [t.type, t.status])).toEqual([
      ['WITHDRAWAL', 'PENDING'],
      ['SPEND_KEY', 'COMPLETED'],
      ['PURCHASE_CREDITS', 'COMPLETED'],
    ]);
    expect(res.body.items[0].amountFiat).toBe('12.5');
    expect(res.body.nextCursor).toBeNull();
  });

  it('pagina por cursor sem repetir nem pular itens', async () => {
    const { token, user } = await registerTestUser();
    for (let i = 0; i < 5; i += 1) {
      await createTransaction(user.id, { amountCredits: i + 1 }, minutesAgo(10 - i));
    }

    const first = await request(app).get('/wallet/transactions?limit=2').set('Authorization', `Bearer ${token}`);
    const second = await request(app)
      .get(`/wallet/transactions?limit=2&cursor=${first.body.nextCursor}`)
      .set('Authorization', `Bearer ${token}`);
    const third = await request(app)
      .get(`/wallet/transactions?limit=2&cursor=${second.body.nextCursor}`)
      .set('Authorization', `Bearer ${token}`);

    const credits = [...first.body.items, ...second.body.items, ...third.body.items].map(
      (t: { amountCredits: number }) => t.amountCredits,
    );
    expect(credits).toEqual([5, 4, 3, 2, 1]);
    expect(third.body.nextCursor).toBeNull();
  });

  it('valida limite e cursor', async () => {
    const { token } = await registerTestUser();

    const tooMany = await request(app).get('/wallet/transactions?limit=500').set('Authorization', `Bearer ${token}`);
    const badCursor = await request(app).get('/wallet/transactions?cursor=abc').set('Authorization', `Bearer ${token}`);

    expect([tooMany.status, badCursor.status]).toEqual([422, 422]);
  });
});

describe('Historico de rodadas', () => {
  it('mostra so as rodadas em que o jogador entrou, com cartelas e premio ganho', async () => {
    const { token, user } = await registerTestUser();
    const other = await registerTestUser();
    const matrix = generateBingoMatrix() as unknown as Prisma.InputJsonValue;

    const wonRound = await prisma.round.create({
      data: { status: 'FINISHED', accumulatedPrize: 8, startedAt: minutesAgo(20), endedAt: minutesAgo(18) },
    });
    await prisma.ticket.createMany({
      data: [
        { roundId: wonRound.id, userId: user.id, numbersMatrix: matrix, isWinner: true, prizeAmount: 4 },
        { roundId: wonRound.id, userId: user.id, numbersMatrix: matrix },
      ],
    });

    const lostRound = await prisma.round.create({ data: { status: 'FINISHED', startedAt: minutesAgo(10) } });
    await prisma.ticket.create({ data: { roundId: lostRound.id, userId: user.id, numbersMatrix: matrix } });

    const notPlayed = await prisma.round.create({ data: { status: 'FINISHED', startedAt: minutesAgo(5) } });
    await prisma.ticket.create({ data: { roundId: notPlayed.id, userId: other.user.id, numbersMatrix: matrix } });

    const res = await request(app).get('/rounds/history/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0]).toMatchObject({ roundId: lostRound.id, ticketsCount: 1, winningTickets: 0, prizeWon: '0.00' });
    expect(res.body.items[1]).toMatchObject({ roundId: wonRound.id, ticketsCount: 2, winningTickets: 1, prizeWon: '4.00' });
  });
});

describe('Log de requisicoes', () => {
  it('devolve um X-Request-Id para rastrear a requisicao nos logs', async () => {
    const res = await request(app).get('/rounds/current');
    const echoed = await request(app).get('/rounds/current').set('X-Request-Id', 'meu-id-123');

    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(echoed.headers['x-request-id']).toBe('meu-id-123');
  });
});
