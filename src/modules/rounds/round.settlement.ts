import { prisma } from '../../lib/prisma';
import { BingoMatrix, isMatrixComplete } from './ticket.util';

export interface WinnerPayout {
  ticketId: string;
  userId: string;
  prize: number;
}

/**
 * Divide o premio em partes iguais por cartela. Os centavos que sobram da divisao
 * vao, um a um, para as cartelas compradas primeiro - nada do premio e perdido.
 */
export function splitPrizeInCents(totalCents: number, winnersCount: number): number[] {
  const baseShare = Math.floor(totalCents / winnersCount);
  const leftover = totalCents - baseShare * winnersCount;
  return Array.from({ length: winnersCount }, (_, index) => baseShare + (index < leftover ? 1 : 0));
}

/**
 * Confere, com a rodada bloqueada, se alguma cartela esta completa com os numeros ja sorteados.
 * Havendo vencedores, encerra a rodada e credita o premio (dividido em caso de empate) numa
 * unica transacao. Retorna null se a rodada nao esta em andamento ou ninguem completou a cartela.
 */
export async function settleRoundIfWon(roundId: string): Promise<WinnerPayout[] | null> {
  return prisma.$transaction(async (tx) => {
    const lockedRounds = await tx.$queryRaw<
      Array<{ status: string; accumulated_prize: string; drawn_numbers: number[] }>
    >`
      SELECT status, accumulated_prize, drawn_numbers FROM rounds WHERE id = ${roundId}::uuid FOR UPDATE
    `;
    const lockedRound = lockedRounds[0];
    if (!lockedRound || lockedRound.status !== 'IN_PROGRESS') {
      return null;
    }

    const tickets = await tx.ticket.findMany({
      where: { roundId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    const winningTickets = tickets.filter((ticket) =>
      isMatrixComplete(ticket.numbersMatrix as unknown as BingoMatrix, lockedRound.drawn_numbers),
    );
    if (winningTickets.length === 0) {
      return null;
    }

    const totalCents = Math.round(Number(lockedRound.accumulated_prize) * 100);
    const shares = splitPrizeInCents(totalCents, winningTickets.length);
    const payouts: WinnerPayout[] = winningTickets.map((ticket, index) => ({
      ticketId: ticket.id,
      userId: ticket.userId,
      prize: shares[index] / 100,
    }));

    await tx.round.update({
      where: { id: roundId },
      data: { status: 'FINISHED', winnerUserId: payouts[0].userId, endedAt: new Date() },
    });

    // Bloqueia as carteiras em ordem fixa para nao gerar deadlock com saques simultaneos
    const winnerUserIds = [...new Set(payouts.map((payout) => payout.userId))];
    await tx.$queryRaw`
      SELECT user_id FROM user_prizes WHERE user_id = ANY(${winnerUserIds}::uuid[]) ORDER BY user_id FOR UPDATE
    `;

    for (const payout of payouts) {
      await tx.ticket.update({
        where: { id: payout.ticketId },
        data: { isWinner: true, prizeAmount: payout.prize },
      });

      await tx.userPrize.update({
        where: { userId: payout.userId },
        data: { balanceFiat: { increment: payout.prize } },
      });

      await tx.transaction.create({
        data: {
          userId: payout.userId,
          type: 'PRIZE_PAYOUT',
          amountFiat: payout.prize,
          status: 'COMPLETED',
        },
      });
    }

    return payouts;
  });
}
