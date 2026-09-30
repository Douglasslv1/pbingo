import { Prisma } from '@prisma/client';
import { afterEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { RoundEngine } from '../src/modules/rounds/round.engine';
import { settleRoundIfWon, splitPrizeInCents } from '../src/modules/rounds/round.settlement';
import { BingoMatrix, flattenMatrixNumbers, generateBingoMatrix } from '../src/modules/rounds/ticket.util';
import { registerTestUser } from './helpers';

const ALL_NUMBERS = Array.from({ length: 75 }, (_, i) => i + 1);

function createRound(data: { status: 'WAITING' | 'IN_PROGRESS'; accumulatedPrize?: number; drawnNumbers?: number[] }) {
  return prisma.round.create({ data });
}

function createTicket(roundId: string, userId: string, matrix: BingoMatrix = generateBingoMatrix()) {
  return prisma.ticket.create({
    data: { roundId, userId, numbersMatrix: matrix as unknown as Prisma.InputJsonValue },
  });
}

async function prizeBalance(userId: string): Promise<string | undefined> {
  const prize = await prisma.userPrize.findUnique({ where: { userId } });
  return prize?.balanceFiat.toString();
}

describe('splitPrizeInCents', () => {
  it('divide igualmente e distribui os centavos restantes para as primeiras cartelas', () => {
    expect(splitPrizeInCents(101, 2)).toEqual([51, 50]);
    expect(splitPrizeInCents(100, 3)).toEqual([34, 33, 33]);
    expect(splitPrizeInCents(500, 1)).toEqual([500]);
  });

  it('nunca perde nem cria centavos', () => {
    for (const [total, count] of [[1, 3], [999, 7], [12345, 4]]) {
      const shares = splitPrizeInCents(total, count);
      expect(shares.reduce((a, b) => a + b, 0)).toBe(total);
    }
  });
});

describe('Liquidacao da rodada', () => {
  it('divide o premio entre cartelas que completam no mesmo numero (empate)', async () => {
    const { user: alice } = await registerTestUser();
    const { user: bob } = await registerTestUser();
    const round = await createRound({ status: 'IN_PROGRESS', accumulatedPrize: 1.01, drawnNumbers: ALL_NUMBERS });
    const aliceTicket = await createTicket(round.id, alice.id);
    const bobTicket = await createTicket(round.id, bob.id);

    const payouts = await settleRoundIfWon(round.id);

    expect(payouts).toEqual([
      { ticketId: aliceTicket.id, userId: alice.id, prize: 0.51 },
      { ticketId: bobTicket.id, userId: bob.id, prize: 0.5 },
    ]);
    expect(await prizeBalance(alice.id)).toBe('0.51');
    expect(await prizeBalance(bob.id)).toBe('0.5');

    const finished = await prisma.round.findUnique({ where: { id: round.id } });
    expect(finished?.status).toBe('FINISHED');
    expect(finished?.winnerUserId).toBe(alice.id);

    const tickets = await prisma.ticket.findMany({ where: { roundId: round.id }, orderBy: { createdAt: 'asc' } });
    expect(tickets.map((t) => [t.isWinner, t.prizeAmount?.toString()])).toEqual([
      [true, '0.51'],
      [true, '0.5'],
    ]);

    const payoutTransactions = await prisma.transaction.count({ where: { type: 'PRIZE_PAYOUT' } });
    expect(payoutTransactions).toBe(2);
  });

  it('paga apenas as cartelas completas quando so uma delas fechou', async () => {
    const { user: winner } = await registerTestUser();
    const { user: loser } = await registerTestUser();
    const winnerMatrix = generateBingoMatrix();
    const round = await createRound({
      status: 'IN_PROGRESS',
      accumulatedPrize: 3.2,
      drawnNumbers: flattenMatrixNumbers(winnerMatrix),
    });
    await createTicket(round.id, winner.id, winnerMatrix);
    // Cartela do perdedor com um numero da coluna O que nao foi sorteado
    const loserMatrix = generateBingoMatrix();
    const missing = [61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75].find(
      (n) => !flattenMatrixNumbers(winnerMatrix).includes(n),
    )!;
    loserMatrix[0][4] = missing;
    await createTicket(round.id, loser.id, loserMatrix);

    const payouts = await settleRoundIfWon(round.id);

    expect(payouts).toHaveLength(1);
    expect(await prizeBalance(winner.id)).toBe('3.2');
    expect(await prizeBalance(loser.id)).toBe('0');
  });

  it('nao encerra a rodada enquanto ninguem completou a cartela', async () => {
    const { user } = await registerTestUser();
    const round = await createRound({ status: 'IN_PROGRESS', accumulatedPrize: 1, drawnNumbers: [] });
    await createTicket(round.id, user.id);

    expect(await settleRoundIfWon(round.id)).toBeNull();
    const current = await prisma.round.findUnique({ where: { id: round.id } });
    expect(current?.status).toBe('IN_PROGRESS');
  });

  it('nao paga duas vezes a mesma rodada', async () => {
    const { user } = await registerTestUser();
    const round = await createRound({ status: 'IN_PROGRESS', accumulatedPrize: 2, drawnNumbers: ALL_NUMBERS });
    await createTicket(round.id, user.id);

    const [first, second] = await Promise.all([settleRoundIfWon(round.id), settleRoundIfWon(round.id)]);

    expect([first, second].filter((result) => result !== null)).toHaveLength(1);
    expect(await prizeBalance(user.id)).toBe('2');
  });
});

describe('Retomada do motor apos reinicio', () => {
  const engine = new RoundEngine();

  afterEach(() => {
    engine.stop();
  });

  it('paga o vencedor de uma rodada interrompida apos o ultimo sorteio', async () => {
    const { user } = await registerTestUser();
    const round = await createRound({ status: 'IN_PROGRESS', accumulatedPrize: 4, drawnNumbers: ALL_NUMBERS });
    await createTicket(round.id, user.id);

    await engine.start();

    const finished = await prisma.round.findUnique({ where: { id: round.id } });
    expect(finished?.status).toBe('FINISHED');
    expect(await prizeBalance(user.id)).toBe('4');
  });

  it('encerra uma rodada interrompida que nao tinha cartelas', async () => {
    const round = await createRound({ status: 'IN_PROGRESS' });

    await engine.start();

    const finished = await prisma.round.findUnique({ where: { id: round.id } });
    expect(finished?.status).toBe('FINISHED');
  });

  it('continua sorteando uma rodada interrompida sem vencedor ainda', async () => {
    const { user } = await registerTestUser();
    const round = await createRound({ status: 'IN_PROGRESS', accumulatedPrize: 1, drawnNumbers: [] });
    await createTicket(round.id, user.id);

    await engine.start();

    const current = await prisma.round.findUnique({ where: { id: round.id } });
    expect(current?.status).toBe('IN_PROGRESS');
    expect(await prisma.round.count({ where: { status: 'WAITING' } })).toBe(0);
  });
});
