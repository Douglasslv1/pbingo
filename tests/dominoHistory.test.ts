import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { env } from '../src/config/env';
import { prisma } from '../src/lib/prisma';
import { cancelStaleQueues, handleTurnTimeout } from '../src/modules/domino/domino.service';
import { DominoState } from '../src/modules/domino/domino.types';
import { makeAdmin, registerTestUser, setCreditBalance } from './helpers';
import { app } from './testApp';

type Player = Awaited<ReturnType<typeof registerTestUser>>;

async function fundedPlayer(): Promise<Player> {
  const player = await registerTestUser();
  await setCreditBalance(player.user.id, 5);
  return player;
}

function joinQueue(player: Player) {
  return request(app)
    .post('/domino/queue')
    .set('Authorization', `Bearer ${player.token}`)
    .send({ mode: 'SIX_TILES', teamMode: 'INDIVIDUAL' });
}

/** Mesa de 4 jogada ate o fim so com jogadas automaticas. */
async function finishedTable() {
  const players = await Promise.all(Array.from({ length: 4 }, () => fundedPlayer()));
  let tableId = '';
  for (const player of players) {
    tableId = (await joinQueue(player)).body.id;
  }
  const later = new Date(Date.now() + 10 * 60_000);
  for (let guard = 0; guard < 100; guard += 1) {
    const table = await prisma.dominoTable.findUniqueOrThrow({ where: { id: tableId } });
    if (table.status !== 'PLAYING') break;
    await handleTurnTimeout(tableId, later);
  }
  const table = await prisma.dominoTable.findUniqueOrThrow({ where: { id: tableId }, include: { seats: true } });
  return { tableId, players, table, state: table.state as unknown as DominoState };
}

describe('Extrato separado por jogo', () => {
  it('marca as chaves gastas e os premios com o jogo de origem', async () => {
    const { players, state, table } = await finishedTable();
    const winnerSeat = table.seats.find((seat) => seat.seat === state.result!.winnerSeats[0])!;
    const winner = players.find((player) => player.user.id === winnerSeat.userId)!;

    const res = await request(app).get('/wallet/transactions').set('Authorization', `Bearer ${winner.token}`);

    const byType = Object.fromEntries(res.body.items.map((t: { type: string; game: string }) => [t.type, t.game]));
    expect(byType).toMatchObject({ SPEND_KEY: 'DOMINO', PRIZE_PAYOUT: 'DOMINO' });
  });

  it('a entrada no bingo fica marcada como BINGO', async () => {
    const player = await fundedPlayer();
    await prisma.round.create({ data: { status: 'WAITING', scheduledAt: new Date(Date.now() + 3_600_000) } });
    await request(app).post('/rounds/join').set('Authorization', `Bearer ${player.token}`);

    const spend = await prisma.transaction.findFirst({ where: { userId: player.user.id, type: 'SPEND_KEY' } });
    expect(spend?.game).toBe('BINGO');
  });
});

describe('Historico de partidas de domino', () => {
  it('lista a partida com o resultado e o premio de cada jogador', async () => {
    const { players, table, state } = await finishedTable();

    for (const player of players) {
      const seat = table.seats.find((s) => s.userId === player.user.id)!;
      const res = await request(app).get('/domino/history/me').set('Authorization', `Bearer ${player.token}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      const won = state.result!.winnerSeats.includes(seat.seat);
      expect(res.body.items[0]).toMatchObject({
        tableId: table.id,
        mode: 'SIX_TILES',
        outcome: won ? 'WON' : 'LOST',
        reason: state.result!.reason,
      });
      expect(Number(res.body.items[0].prizeWon)).toBe(won ? Number(seat.prizeAmount) : 0);
    }
  });

  it('mostra mesas canceladas e nao mostra mesas ainda em espera', async () => {
    const cancelled = await fundedPlayer();
    const joined = await joinQueue(cancelled);
    await prisma.dominoTable.update({
      where: { id: joined.body.id },
      data: { createdAt: new Date(Date.now() - (env.dominoQueueTimeoutMinutes + 1) * 60_000) },
    });
    await cancelStaleQueues();
    await joinQueue(cancelled);

    const res = await request(app).get('/domino/history/me').set('Authorization', `Bearer ${cancelled.token}`);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ outcome: 'CANCELLED', prizeWon: '0' });
  });
});

describe('Painel admin do domino', () => {
  it('bloqueia jogadores e mostra ao admin as mesas, as maos e todas as jogadas', async () => {
    const { tableId, players, state } = await finishedTable();
    const admin = await registerTestUser();
    await makeAdmin(admin.user.id);

    const blocked = await request(app).get('/admin/domino/tables').set('Authorization', `Bearer ${players[0].token}`);
    expect(blocked.status).toBe(403);

    const list = await request(app).get('/admin/domino/tables?status=FINISHED').set('Authorization', `Bearer ${admin.token}`);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ id: tableId, status: 'FINISHED', moveCount: state.moveCount });
    expect(list.body[0].players).toHaveLength(4);

    const detail = await request(app).get(`/admin/domino/tables/${tableId}`).set('Authorization', `Bearer ${admin.token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.moves).toHaveLength(state.moveCount);
    expect(detail.body.players.map((p: { hand: unknown }) => p.hand)).toEqual(state.hands);
    expect(detail.body.result).toEqual(state.result);
  });
});
