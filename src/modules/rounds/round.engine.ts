import { randomInt } from 'crypto';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { broadcast } from '../../websocket/socket';
import { countPlayers, openWaitingRound, startOrCancelRound } from './round.lifecycle';
import { settleRoundIfWon, WinnerPayout } from './round.settlement';
import { toRoundView } from './rounds.service';

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
      logger.warn('Retomando sorteio de rodada interrompida', { roundId: interruptedRound.id });
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
        logger.error(errorMessage, { err });
      });
    }, delayMs);
    this.pendingTimeouts.add(timeout);
  }

  /** Abre (ou reaproveita) a sala da proxima rodada e agenda a decisao para o horario marcado. */
  private async ensureWaitingRound(): Promise<void> {
    const round = await openWaitingRound();
    const scheduledAt = round.scheduledAt ?? new Date();

    broadcast('round:waiting', toRoundView(round, await countPlayers(prisma, round.id)));

    const remainingMs = Math.max(scheduledAt.getTime() - Date.now(), 0);
    this.schedule(() => this.resolveWaitingRound(round.id), remainingMs, 'Erro ao iniciar ou cancelar a rodada');
  }

  /** No horario marcado: comeca o sorteio ou, sem o minimo de jogadores, cancela e devolve as chaves. */
  private async resolveWaitingRound(roundId: string): Promise<void> {
    const result = await startOrCancelRound(roundId);

    if (result.outcome === 'started') {
      await this.runDrawPhase(roundId);
      return;
    }

    if (result.outcome === 'cancelled') {
      logger.info('Rodada cancelada por falta de jogadores', {
        roundId,
        playersCount: result.playersCount,
        minPlayers: env.minPlayersPerRound,
      });
      broadcast('round:cancelled', {
        roundId,
        playersCount: result.playersCount,
        minPlayers: env.minPlayersPerRound,
      });
      this.scheduleNextRound();
    }
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
        logger.error('Erro ao sortear número', { roundId, err });
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
    this.schedule(() => this.ensureWaitingRound(), env.nextRoundDelayMs, 'Erro ao abrir próxima rodada');
  }
}

export const roundEngine = new RoundEngine();
