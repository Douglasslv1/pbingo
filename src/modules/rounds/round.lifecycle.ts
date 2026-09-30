import { Prisma, Round } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/errors';
import { nextRoundSlot } from './round.schedule';

export type WaitingRoundOutcome =
  | { outcome: 'started' }
  | { outcome: 'cancelled'; playersCount: number }
  | { outcome: 'skipped' };

interface RefundableTicket {
  id: string;
  userId: string;
  creditsSpent: number;
  prizeContribution: Prisma.Decimal;
}

export async function countPlayers(tx: Prisma.TransactionClient, roundId: string): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ players: bigint }>>`
    SELECT COUNT(DISTINCT user_id) AS players FROM tickets WHERE round_id = ${roundId}::uuid
  `;
  return Number(rows[0]?.players ?? 0);
}

async function lockRound(tx: Prisma.TransactionClient, roundId: string) {
  const rows = await tx.$queryRaw<Array<{ status: string; scheduled_at: Date | null }>>`
    SELECT status, scheduled_at FROM rounds WHERE id = ${roundId}::uuid FOR UPDATE
  `;
  return rows[0] ?? null;
}

/** Devolve as chaves das cartelas e registra a devolucao no extrato de cada jogador. */
async function refundTickets(tx: Prisma.TransactionClient, tickets: RefundableTicket[]): Promise<void> {
  const userIds = [...new Set(tickets.map((ticket) => ticket.userId))];
  if (userIds.length === 0) {
    return;
  }

  // Bloqueia as carteiras em ordem fixa para nao gerar deadlock com compras simultaneas
  await tx.$queryRaw`
    SELECT user_id FROM user_credits WHERE user_id = ANY(${userIds}::uuid[]) ORDER BY user_id FOR UPDATE
  `;

  for (const ticket of tickets) {
    await tx.userCredit.update({
      where: { userId: ticket.userId },
      data: { balance: { increment: ticket.creditsSpent } },
    });
    await tx.transaction.create({
      data: {
        userId: ticket.userId,
        type: 'KEY_REFUND',
        amountCredits: ticket.creditsSpent,
        status: 'COMPLETED',
        game: 'BINGO',
      },
    });
  }
}

/** Retorna a rodada aberta para entrada, criando-a no proximo horario da grade se nao houver. */
export async function openWaitingRound(now = new Date()): Promise<Round> {
  const existing = await prisma.round.findFirst({
    where: { status: 'WAITING' },
    orderBy: { startedAt: 'desc' },
  });

  if (existing?.scheduledAt) {
    return existing;
  }
  if (existing) {
    // Rodada aberta antes da grade existir: passa a seguir o proximo horario
    return prisma.round.update({
      where: { id: existing.id },
      data: { scheduledAt: nextRoundSlot(now, env.roundIntervalMinutes) },
    });
  }

  return prisma.round.create({
    data: { status: 'WAITING', scheduledAt: nextRoundSlot(now, env.roundIntervalMinutes) },
  });
}

/**
 * No horario da rodada: com o minimo de jogadores diferentes ela comeca; sem o minimo,
 * e cancelada e todas as chaves voltam para os jogadores - numa unica transacao.
 */
export async function startOrCancelRound(roundId: string): Promise<WaitingRoundOutcome> {
  return prisma.$transaction(async (tx) => {
    const round = await lockRound(tx, roundId);
    if (!round || round.status !== 'WAITING') {
      return { outcome: 'skipped' };
    }

    const playersCount = await countPlayers(tx, roundId);
    if (playersCount >= env.minPlayersPerRound) {
      await tx.round.update({ where: { id: roundId }, data: { status: 'IN_PROGRESS' } });
      return { outcome: 'started' };
    }

    const tickets = await tx.ticket.findMany({
      where: { roundId },
      select: { id: true, userId: true, creditsSpent: true, prizeContribution: true },
    });
    await refundTickets(tx, tickets);
    await tx.round.update({
      where: { id: roundId },
      data: { status: 'CANCELLED', accumulatedPrize: 0, endedAt: new Date() },
    });

    return { outcome: 'cancelled', playersCount };
  });
}

/** O jogador desiste antes do inicio: remove as cartelas dele, devolve as chaves e tira a parte dele do premio. */
export async function leaveWaitingRound(userId: string) {
  return prisma.$transaction(async (tx) => {
    const waiting = await tx.round.findFirst({
      where: { status: 'WAITING', tickets: { some: { userId } } },
      orderBy: { startedAt: 'desc' },
      select: { id: true },
    });
    if (!waiting) {
      throw new AppError('Voce nao esta em nenhuma rodada aguardando inicio', 409);
    }

    const round = await lockRound(tx, waiting.id);
    if (!round || round.status !== 'WAITING') {
      throw new AppError('A rodada ja comecou - nao e mais possivel sair', 409);
    }

    const tickets = await tx.ticket.findMany({
      where: { roundId: waiting.id, userId },
      select: { id: true, userId: true, creditsSpent: true, prizeContribution: true },
    });
    const contribution = tickets.reduce((sum, ticket) => sum.plus(ticket.prizeContribution), new Prisma.Decimal(0));

    await refundTickets(tx, tickets);
    await tx.ticket.deleteMany({ where: { roundId: waiting.id, userId } });
    const updated = await tx.round.update({
      where: { id: waiting.id },
      data: { accumulatedPrize: { decrement: contribution } },
    });

    return {
      roundId: waiting.id,
      refundedCredits: tickets.reduce((sum, ticket) => sum + ticket.creditsSpent, 0),
      accumulatedPrize: updated.accumulatedPrize.toString(),
      playersCount: await countPlayers(tx, waiting.id),
    };
  });
}
