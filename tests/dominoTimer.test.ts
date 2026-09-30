import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env';
import { prisma } from '../src/lib/prisma';
import { clearAllTurnTimeouts, scheduleTurnTimeout } from '../src/modules/domino/domino.scheduler';
import { AWAY_TURN_MS, handleTurnTimeout, restoreTurnTimers } from '../src/modules/domino/domino.service';
import { DominoState } from '../src/modules/domino/domino.types';
import { registerTestUser, setCreditBalance } from './helpers';
import { app } from './testApp';

type Player = Awaited<ReturnType<typeof registerTestUser>>;

afterEach(() => {
  clearAllTurnTimeouts();
});

/** Instante bem depois de qualquer prazo, para simular o tempo esgotado. */
const later = () => new Date(Date.now() + 10 * 60_000);

async function startedTable() {
  const players: Player[] = [];
  let tableId = '';
  for (let i = 0; i < 4; i += 1) {
    const player = await registerTestUser();
    await setCreditBalance(player.user.id, 5);
    const res = await request(app)
      .post('/domino/queue')
      .set('Authorization', `Bearer ${player.token}`)
      .send({ mode: 'SIX_TILES', teamMode: 'INDIVIDUAL' });
    tableId = res.body.id;
    players.push(player);
  }
  const seats = await prisma.dominoSeat.findMany({ where: { tableId } });
  const bySeat = (seat: number) => players.find((p) => p.user.id === seats.find((s) => s.seat === seat)?.userId)!;
  return { tableId, bySeat };
}

async function table(tableId: string) {
  const row = await prisma.dominoTable.findUniqueOrThrow({ where: { id: tableId }, include: { seats: true } });
  return { ...row, game: row.state as unknown as DominoState };
}

const seatOf = (t: Awaited<ReturnType<typeof table>>, seat: number) => t.seats.find((s) => s.seat === seat)!;

describe('Cronometro da jogada no domino', () => {
  it('a partida comeca com o prazo da primeira jogada', async () => {
    const { tableId } = await startedTable();
    const t = await table(tableId);

    const remaining = t.turnDeadline!.getTime() - Date.now();
    expect(remaining).toBeGreaterThan((env.dominoTurnSeconds - 5) * 1000);
    expect(remaining).toBeLessThanOrEqual(env.dominoTurnSeconds * 1000);
  });

  it('nao faz nada antes do prazo vencer', async () => {
    const { tableId } = await startedTable();

    await handleTurnTimeout(tableId, new Date());

    expect(await prisma.dominoMove.count({ where: { tableId } })).toBe(0);
  });

  it('com o prazo vencido joga pelo jogador e conta o tempo esgotado', async () => {
    const { tableId } = await startedTable();
    const before = await table(tableId);
    const seat = before.game.currentSeat;

    await handleTurnTimeout(tableId, later());

    const after = await table(tableId);
    const moves = await prisma.dominoMove.findMany({ where: { tableId }, orderBy: { moveNumber: 'asc' } });
    expect(moves[0]).toMatchObject({ seat, automatic: true });
    expect(after.game.line).toHaveLength(1);
    expect(seatOf(after, seat)).toMatchObject({ timeouts: 1, isAway: false });
  });

  it('dois tempos esgotados seguidos marcam como ausente e o prazo dele cai para poucos segundos', async () => {
    const { tableId } = await startedTable();

    // Ninguem joga: cada rodada de tempos esgotados passa por todos os lugares
    let t = await table(tableId);
    while (t.status === 'PLAYING' && t.seats.some((s) => !s.isAway)) {
      await handleTurnTimeout(tableId, later());
      t = await table(tableId);
    }

    expect(t.seats.some((s) => s.isAway && s.timeouts >= 2)).toBe(true);
    if (t.status === 'PLAYING') {
      expect(t.seats.every((s) => s.isAway)).toBe(true);
      const remaining = t.turnDeadline!.getTime() - Date.now();
      expect(remaining).toBeLessThanOrEqual(AWAY_TURN_MS);
    }
  });

  it('partida so com jogadores ausentes termina sozinha e paga os vencedores', async () => {
    const { tableId } = await startedTable();

    let t = await table(tableId);
    for (let guard = 0; t.status === 'PLAYING'; guard += 1) {
      expect(guard).toBeLessThan(100);
      await handleTurnTimeout(tableId, later());
      t = await table(tableId);
    }

    expect(t.status).toBe('FINISHED');
    expect(t.turnDeadline).toBeNull();
    const paid = t.seats.reduce((sum, s) => sum + Math.round(Number(s.prizeAmount ?? 0) * 100), 0);
    expect(paid).toBe(Math.round(Number(t.prizePool) * 100));
  });

  it('jogar de verdade tira a marca de ausente e devolve o prazo normal', async () => {
    const { tableId, bySeat } = await startedTable();
    const start = await table(tableId);
    const seat = start.game.currentSeat;
    await prisma.dominoSeat.updateMany({ where: { tableId, seat }, data: { timeouts: 2, isAway: true } });

    const res = await request(app)
      .post(`/domino/tables/${tableId}/moves`)
      .set('Authorization', `Bearer ${bySeat(seat).token}`)
      .send({ type: 'PLAY', tile: start.game.openingTile, side: 'LEFT' });

    expect(res.status).toBe(200);
    expect(seatOf(await table(tableId), seat)).toMatchObject({ timeouts: 0, isAway: false });
    expect(res.body.players.find((p: { seat: number }) => p.seat === seat).away).toBe(false);
  });

  it('"Voltei" devolve o controle e o prazo normal se for a vez do jogador', async () => {
    const { tableId, bySeat } = await startedTable();
    const start = await table(tableId);
    const seat = start.game.currentSeat;
    await prisma.dominoSeat.updateMany({ where: { tableId, seat }, data: { timeouts: 2, isAway: true } });
    await prisma.dominoTable.update({ where: { id: tableId }, data: { turnDeadline: new Date(Date.now() + AWAY_TURN_MS) } });

    const res = await request(app)
      .post(`/domino/tables/${tableId}/back`)
      .set('Authorization', `Bearer ${bySeat(seat).token}`);

    expect(res.status).toBe(200);
    const after = await table(tableId);
    expect(seatOf(after, seat)).toMatchObject({ timeouts: 0, isAway: false });
    expect(after.turnDeadline!.getTime() - Date.now()).toBeGreaterThan((env.dominoTurnSeconds - 5) * 1000);
  });

  it('o cronometro agendado dispara a jogada automatica, inclusive apos reinicio', async () => {
    const { tableId } = await startedTable();
    await prisma.dominoTable.update({ where: { id: tableId }, data: { turnDeadline: new Date(Date.now() - 1000) } });

    // Simula o servidor subindo: religa os cronometros a partir do banco
    expect(await restoreTurnTimers()).toBe(1);

    await expect.poll(() => prisma.dominoMove.count({ where: { tableId } }), { timeout: 5000 }).toBeGreaterThan(0);
  });

  it('reagendar substitui o cronometro anterior da mesa', async () => {
    const { tableId } = await startedTable();
    await prisma.dominoTable.update({ where: { id: tableId }, data: { turnDeadline: new Date(Date.now() - 1000) } });

    scheduleTurnTimeout(tableId, new Date(Date.now() + 60_000));
    scheduleTurnTimeout(tableId, null);
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(await prisma.dominoMove.count({ where: { tableId } })).toBe(0);
  });
});
