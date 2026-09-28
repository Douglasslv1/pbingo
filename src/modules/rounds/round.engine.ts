import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { broadcast } from '../../websocket/socket';
import { BingoMatrix, isMatrixComplete } from './ticket.util';

const BALL_MIN = 1;
const BALL_MAX = 75;

class RoundEngine {
  private drawTimer: NodeJS.Timeout | null = null;
  private isDrawing = false;

  async start(): Promise<void> {
    await this.ensureWaitingRound();
  }

  private async ensureWaitingRound(): Promise<void> {
    let round = await prisma.round.findFirst({
      where: { status: 'WAITING' },
      orderBy: { startedAt: 'desc' },
    });

    if (!round) {
      round = await prisma.round.create({ data: { status: 'WAITING' } });
    }

    const endsAt = round.startedAt.getTime() + env.roundWaitMs;
    const remainingMs = Math.max(endsAt - Date.now(), 0);
    const roundId = round.id;

    broadcast('round:waiting', {
      roundId,
      endsAt: new Date(endsAt).toISOString(),
    });

    setTimeout(() => {
      this.startDrawPhase(roundId).catch((err) => {
        console.error('Erro ao iniciar fase de sorteio', err);
      });
    }, remainingMs);
  }

  private async startDrawPhase(roundId: string): Promise<void> {
    const round = await prisma.round.update({
      where: { id: roundId },
      data: { status: 'IN_PROGRESS' },
      include: { tickets: true },
    });

    broadcast('round:started', { roundId: round.id });

    if (round.tickets.length === 0) {
      await this.finishRoundWithoutWinner(roundId, null);
      return;
    }

    this.drawTimer = setInterval(() => {
      this.drawNumber(roundId).catch((err) => {
        console.error('Erro ao sortear numero', err);
      });
    }, env.drawIntervalMs);
  }

  private async drawNumber(roundId: string): Promise<void> {
    if (this.isDrawing) {
      return;
    }
    this.isDrawing = true;

    try {
      const round = await prisma.round.findUnique({ where: { id: roundId } });
      if (!round || round.status !== 'IN_PROGRESS') {
        this.stopDrawTimer();
        return;
      }

      const remainingNumbers: number[] = [];
      for (let n = BALL_MIN; n <= BALL_MAX; n += 1) {
        if (!round.drawnNumbers.includes(n)) {
          remainingNumbers.push(n);
        }
      }

      if (remainingNumbers.length === 0) {
        this.stopDrawTimer();
        await this.finishRoundWithoutWinner(roundId, null);
        return;
      }

      const number = remainingNumbers[Math.floor(Math.random() * remainingNumbers.length)];
      const updatedRound = await prisma.round.update({
        where: { id: roundId },
        data: { drawnNumbers: { push: number } },
      });

      broadcast('number:drawn', {
        roundId,
        number,
        drawnNumbers: updatedRound.drawnNumbers,
      });

      const tickets = await prisma.ticket.findMany({
        where: { roundId, isWinner: false },
      });

      const winningTicket = tickets.find((ticket) =>
        isMatrixComplete(ticket.numbersMatrix as unknown as BingoMatrix, updatedRound.drawnNumbers),
      );

      if (winningTicket) {
        this.stopDrawTimer();
        await this.payoutWinner(roundId, winningTicket.id, winningTicket.userId);
      }
    } finally {
      this.isDrawing = false;
    }
  }

  private stopDrawTimer(): void {
    if (this.drawTimer) {
      clearInterval(this.drawTimer);
      this.drawTimer = null;
    }
  }

  private async payoutWinner(roundId: string, ticketId: string, winnerUserId: string): Promise<void> {
    const prizeAmount = await prisma.$transaction(async (tx) => {
      const lockedRounds = await tx.$queryRaw<Array<{ status: string; accumulated_prize: string }>>`
        SELECT status, accumulated_prize FROM rounds WHERE id = ${roundId}::uuid FOR UPDATE
      `;
      const lockedRound = lockedRounds[0];
      if (!lockedRound || lockedRound.status !== 'IN_PROGRESS') {
        return null;
      }

      const prize = Number(lockedRound.accumulated_prize);

      await tx.round.update({
        where: { id: roundId },
        data: { status: 'FINISHED', winnerUserId, endedAt: new Date() },
      });

      await tx.ticket.update({ where: { id: ticketId }, data: { isWinner: true } });

      await tx.$queryRaw`SELECT balance_fiat FROM user_prizes WHERE user_id = ${winnerUserId}::uuid FOR UPDATE`;

      await tx.userPrize.update({
        where: { userId: winnerUserId },
        data: { balanceFiat: { increment: prize } },
      });

      await tx.transaction.create({
        data: {
          userId: winnerUserId,
          type: 'PRIZE_PAYOUT',
          amountFiat: prize,
          status: 'COMPLETED',
        },
      });

      return prize;
    });

    if (prizeAmount === null) {
      return;
    }

    broadcast('round:finished', { roundId, winnerUserId, prize: prizeAmount });
    this.scheduleNextRound();
  }

  private async finishRoundWithoutWinner(roundId: string, winnerUserId: string | null): Promise<void> {
    await prisma.round.update({
      where: { id: roundId },
      data: { status: 'FINISHED', endedAt: new Date() },
    });

    broadcast('round:finished', { roundId, winnerUserId, prize: null });
    this.scheduleNextRound();
  }

  private scheduleNextRound(): void {
    setTimeout(() => {
      this.ensureWaitingRound().catch((err) => {
        console.error('Erro ao abrir proxima rodada', err);
      });
    }, env.nextRoundDelayMs);
  }
}

export const roundEngine = new RoundEngine();
