import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { AppError } from '../../utils/errors';
import { HistoryPage } from '../../utils/pagination';
import { broadcast } from '../../websocket/socket';
import { generateBingoMatrix } from './ticket.util';

export async function joinCurrentRound(userId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const waitingRounds = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM rounds
      WHERE status = 'WAITING'::round_status
      ORDER BY started_at DESC
      LIMIT 1
      FOR UPDATE
    `;

    if (waitingRounds.length === 0) {
      throw new AppError('Nenhuma rodada aberta para entrada no momento', 409);
    }
    const roundId = waitingRounds[0].id;

    const creditRows = await tx.$queryRaw<Array<{ balance: number }>>`
      SELECT balance FROM user_credits WHERE user_id = ${userId}::uuid FOR UPDATE
    `;
    const currentBalance = creditRows[0]?.balance ?? 0;

    if (currentBalance < env.ticketPriceCredits) {
      throw new AppError('Saldo de chaves insuficiente para entrar na rodada', 400);
    }

    await tx.userCredit.update({
      where: { userId },
      data: { balance: { decrement: env.ticketPriceCredits } },
    });

    await tx.transaction.create({
      data: {
        userId,
        type: 'SPEND_KEY',
        amountCredits: env.ticketPriceCredits,
        status: 'COMPLETED',
      },
    });

    const matrix = generateBingoMatrix();

    const ticket = await tx.ticket.create({
      data: {
        roundId,
        userId,
        numbersMatrix: matrix as unknown as Prisma.InputJsonValue,
      },
    });

    const updatedRound = await tx.round.update({
      where: { id: roundId },
      data: { accumulatedPrize: { increment: env.prizeContributionPerTicket } },
    });

    return { ticket, round: updatedRound };
  });

  broadcast('round:player_joined', {
    roundId: result.round.id,
    accumulatedPrize: result.round.accumulatedPrize.toString(),
  });

  return {
    ticketId: result.ticket.id,
    roundId: result.round.id,
    numbersMatrix: result.ticket.numbersMatrix,
    accumulatedPrize: result.round.accumulatedPrize.toString(),
  };
}

export async function getCurrentRoundView() {
  const round = await prisma.round.findFirst({
    where: { status: { in: ['WAITING', 'IN_PROGRESS'] } },
    orderBy: { startedAt: 'desc' },
  });

  if (!round) {
    return null;
  }

  return {
    id: round.id,
    status: round.status,
    accumulatedPrize: round.accumulatedPrize.toString(),
    drawnNumbers: round.drawnNumbers,
    startedAt: round.startedAt.toISOString(),
    waitingEndsAt:
      round.status === 'WAITING'
        ? new Date(round.startedAt.getTime() + env.roundWaitMs).toISOString()
        : null,
  };
}

export async function getMyTicketsForRound(userId: string, roundId: string) {
  return prisma.ticket.findMany({
    where: { userId, roundId },
    orderBy: { createdAt: 'asc' },
  });
}

/** Rodadas em que o jogador comprou cartela, da mais recente para a mais antiga, paginadas por cursor. */
export async function listMyRounds(userId: string, { limit, cursor }: HistoryPage) {
  const rounds = await prisma.round.findMany({
    where: { tickets: { some: { userId } } },
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { tickets: { where: { userId }, select: { isWinner: true, prizeAmount: true } } },
  });

  const hasMore = rounds.length > limit;
  const items = rounds.slice(0, limit).map((round) => {
    const prizeWonCents = round.tickets.reduce(
      (sum, ticket) => sum + Math.round(Number(ticket.prizeAmount ?? 0) * 100),
      0,
    );
    return {
      roundId: round.id,
      status: round.status,
      startedAt: round.startedAt.toISOString(),
      endedAt: round.endedAt?.toISOString() ?? null,
      accumulatedPrize: round.accumulatedPrize.toString(),
      ticketsCount: round.tickets.length,
      winningTickets: round.tickets.filter((ticket) => ticket.isWinner).length,
      prizeWon: (prizeWonCents / 100).toFixed(2),
    };
  });

  return { items, nextCursor: hasMore ? items[items.length - 1].roundId : null };
}
