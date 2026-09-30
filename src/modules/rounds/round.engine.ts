import { randomInt } from 'crypto';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { broadcast } from '../../websocket/socket';
import { settleRoundIfWon, WinnerPayout } from './round.settlement';

const BALL_MIN = 1;
const BALL_MAX = 75;

export class RoundEngine {
  private drawTimer: NodeJS.Timeout | null = null;
  private pendingTimeouts = new Set<NodeJS.Timeout>();
  private isDrawing = false;

  /**
   * Ao subir o servidor, retoma a rodada que estava em sorteio (ex.: apos um deploy ou queda)
   * em vez de deixa-la presa em IN_PROGRESS com as chaves dos jogadores ja gastas.
   */
  async start(): Promise<void> {
    const interruptedRound = await prisma.round.findFirst({
      where: { status: 'IN_PROGRESS' },
      orderBy: { startedAt: 'desc' },
    });

    if (interruptedRound) {
      console.log(`Retomando sorteio da rodada ${interruptedRound.id}`);
      await this.runDrawPhase(interruptedRound.id);
      return;
    }

    await this.ensureWaitingRound();
  }

  /** Cancela todos os timers pendentes. */
  stop(): void {
    this.stopDrawTimer();
    this.pendingTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.pendingTimeouts.clear();
  }

  private schedule(task: () => Promise<void>, delayMs: number, errorMessage: string): void {
    const timeout = setTimeout(() => {
      this.pendingTimeouts.delete(timeout);
      task().catch((err) => {
        console.error(errorMessage, err);
      });
    }, delayMs);
    this.pendingTimeouts.add(timeout);
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

    this.schedule(() => this.startDrawPhase(roundId), remainingMs, 'Erro ao iniciar fase de sorteio');
  }

  private async startDrawPhase(roundId: string): Promise<void> {
    await prisma.round.update({
      where: { id: roundId },
      data: { status: 'IN_PROGRESS' },
    });

    await this.runDrawPhase(roundId);
  }

  private async runDrawPhase(roundId: string): Promise<void> {
    broadcast('round:started', { roundId });

    const ticketsCount = await prisma.ticket.count({ where: { roundId } });
    if (ticketsCount === 0) {
      await this.finishRoundWithoutWinner(roundId);
      return;
    }

    // Numa retomada, o ultimo numero pode ter sido sorteado sem que o premio fosse pago
    if (await this.settleIfWon(roundId)) {
      return;
    }

    this.stopDrawTimer();
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
        await this.finishRoundWithoutWinner(roundId);
        return;
      }

      const number = remainingNumbers[randomInt(remainingNumbers.length)];
      const updatedRound = await prisma.round.update({
        where: { id: roundId },
        data: { drawnNumbers: { push: number } },
      });

      broadcast('number:drawn', {
        roundId,
        number,
        drawnNumbers: updatedRound.drawnNumbers,
      });

      await this.settleIfWon(roundId);
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

  private async settleIfWon(roundId: string): Promise<boolean> {
    const payouts = await settleRoundIfWon(roundId);
    if (!payouts) {
      return false;
    }

    this.stopDrawTimer();
    this.broadcastFinished(roundId, payouts);
    this.scheduleNextRound();
    return true;
  }

  private broadcastFinished(roundId: string, winners: WinnerPayout[]): void {
    const totalPrize = winners.reduce((sum, winner) => sum + Math.round(winner.prize * 100), 0) / 100;
    broadcast('round:finished', {
      roundId,
      winnerUserId: winners[0]?.userId ?? null,
      prize: winners.length > 0 ? totalPrize : null,
      winners,
    });
  }

  private async finishRoundWithoutWinner(roundId: string): Promise<void> {
    await prisma.round.update({
      where: { id: roundId },
      data: { status: 'FINISHED', endedAt: new Date() },
    });

    this.broadcastFinished(roundId, []);
    this.scheduleNextRound();
  }

  private scheduleNextRound(): void {
    this.schedule(() => this.ensureWaitingRound(), env.nextRoundDelayMs, 'Erro ao abrir proxima rodada');
  }
}

export const roundEngine = new RoundEngine();
