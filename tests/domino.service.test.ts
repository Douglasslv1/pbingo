import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { env } from '../src/config/env';
import { prisma } from '../src/lib/prisma';
import { autoAction } from '../src/modules/domino/domino.engine';
import { cancelStaleQueues } from '../src/modules/domino/domino.service';
import { DominoAction, DominoState } from '../src/modules/domino/domino.types';
import { registerTestUser, setCreditBalance } from './helpers';
import { app } from './testApp';

type Player = Awaited<ReturnType<typeof registerTestUser>>;

const SIX_INDIVIDUAL = { mode: 'SIX_TILES', teamMode: 'INDIVIDUAL' };

async function fundedPlayer(credits = 5): Promise<Player> {
  const player = await registerTestUser();
  await setCreditBalance(player.user.id, credits);
  return player;
}

function joinQueue(player: Player, choice: Record<string, string> = SIX_INDIVIDUAL) {
  return request(app).post('/domino/queue').set('Authorization', `Bearer ${player.token}`).send(choice);
}

function move(player: Player, tableId: string, action: DominoAction) {
  return request(app).post(`/domino/tables/${tableId}/moves`).set('Authorization', `Bearer ${player.token}`).send(action);
}

async function credits(userId: string) {
  return (await prisma.userCredit.findUnique({ where: { userId } }))?.balance;
}

const DUEL = { mode: 'SIX_TILES', teamMode: 'DUEL' };

/** Jogadores com chaves numa mesa que ja comecou (4, ou 2 no mano a mano). */
async function fullTable(choice: Record<string, string> = SIX_INDIVIDUAL) {
  const players: Player[] = [];
  let tableId = '';
  for (let i = 0; i < (choice.teamMode === 'DUEL' ? 2 : 4); i += 1) {
    const player = await fundedPlayer();
    const res = await joinQueue(player, choice);
    expect(res.status).toBe(201);
    tableId = res.body.id;
    players.push(player);
  }
  const seats = await prisma.dominoSeat.findMany({ where: { tableId } });
  const bySeat = (seat: number) => players.find((p) => p.user.id === seats.find((s) => s.seat === seat)?.userId)!;
  return { tableId, players, bySeat };
}

async function tableState(tableId: string): Promise<DominoState> {
  return (await prisma.dominoTable.findUniqueOrThrow({ where: { id: tableId } })).state as unknown as DominoState;
}

describe('Fila e mesas de domino', () => {
  it('forma a mesa com 4 jogadores, cobra 1 chave de cada e comeca a partida', async () => {
    const first = await fundedPlayer();
    const waiting = await joinQueue(first);
    expect(waiting.status).toBe(201);
    expect(waiting.body).toMatchObject({ status: 'WAITING', mySeat: 0, game: null });

    const { tableId, players } = await fullTable();
    // O primeiro jogador ja estava na fila: a mesa dele fecha com mais 3 e sobra 1 numa mesa nova
    const firstTable = await prisma.dominoTable.findUniqueOrThrow({ where: { id: waiting.body.id }, include: { seats: true } });
    expect(firstTable.status).toBe('PLAYING');
    expect(firstTable.seats).toHaveLength(4);
    expect(firstTable.prizePool.toString()).toBe((4 * env.prizeContributionPerTicket).toString());
    expect(await credits(first.user.id)).toBe(4);

    const leftover = await prisma.dominoTable.findUniqueOrThrow({ where: { id: tableId } });
    expect(leftover.status).toBe('WAITING');
    expect(players).toHaveLength(4);
  });

  it('cada jogador ve apenas a propria mao', async () => {
    const { tableId, players } = await fullTable();
    const state = await tableState(tableId);

    for (const player of players) {
      const res = await request(app).get('/domino/tables/me').set('Authorization', `Bearer ${player.token}`);
      const seat = res.body.mySeat;
      expect(res.body.game.hand).toEqual(state.hands[seat]);
      expect(res.body.game.handSizes).toEqual([6, 6, 6, 6]);
      expect(res.body.game.revealedHands).toBeNull();
      expect(res.body.players.map((p: { seat: number }) => p.seat)).toEqual([0, 1, 2, 3]);
    }
  });

  it('separa as filas por modalidade e formato', async () => {
    const a = await joinQueue(await fundedPlayer(), SIX_INDIVIDUAL);
    const b = await joinQueue(await fundedPlayer(), { mode: 'BURRINHO', teamMode: 'INDIVIDUAL' });
    const c = await joinQueue(await fundedPlayer(), { mode: 'SIX_TILES', teamMode: 'PAIRS' });

    expect(new Set([a.body.id, b.body.id, c.body.id]).size).toBe(3);
  });

  it('recusa entrar duas vezes, sem chaves ou sem aceite dos termos', async () => {
    const player = await fundedPlayer();
    await joinQueue(player);
    const twice = await joinQueue(player);

    const broke = await fundedPlayer(0);
    const noKeys = await joinQueue(broke);

    const legacy = await fundedPlayer();
    await prisma.user.update({ where: { id: legacy.user.id }, data: { termsVersion: null } });
    const noTerms = await joinQueue(legacy);

    expect([twice.status, noKeys.status, noTerms.status]).toEqual([409, 400, 403]);
    expect(await credits(player.user.id)).toBe(4);
  });

  it('nunca coloca mais de 4 jogadores na mesma mesa, mesmo com entradas simultaneas', async () => {
    const players = await Promise.all(Array.from({ length: 6 }, () => fundedPlayer()));
    const results = await Promise.all(players.map((player) => joinQueue(player)));

    expect(results.every((res) => res.status === 201)).toBe(true);
    const tables = await prisma.dominoTable.findMany({ include: { seats: true }, orderBy: { createdAt: 'asc' } });
    expect(tables.map((table) => table.seats.length)).toEqual([4, 2]);
    expect(tables.map((table) => table.status)).toEqual(['PLAYING', 'WAITING']);
  });

  it('sair da fila devolve a chave; o ultimo a sair cancela a mesa', async () => {
    const stays = await fundedPlayer();
    const leaves = await fundedPlayer();
    await joinQueue(stays);
    const joined = await joinQueue(leaves);

    const res = await request(app).post('/domino/queue/leave').set('Authorization', `Bearer ${leaves.token}`);
    expect(res.status).toBe(200);
    expect(await credits(leaves.user.id)).toBe(5);

    const table = await prisma.dominoTable.findUniqueOrThrow({ where: { id: joined.body.id }, include: { seats: true } });
    expect(table.seats).toHaveLength(1);
    expect(table.prizePool.toString()).toBe(env.prizeContributionPerTicket.toString());

    await request(app).post('/domino/queue/leave').set('Authorization', `Bearer ${stays.token}`);
    const empty = await prisma.dominoTable.findUniqueOrThrow({ where: { id: joined.body.id } });
    expect(empty.status).toBe('CANCELLED');
  });

  it('mano a mano comeca com 2 jogadores e so existe no 6 pecas', async () => {
    const { tableId } = await fullTable(DUEL);
    const state = await tableState(tableId);
    expect(state.hands.map((hand) => hand.length)).toEqual([6, 6]);
    expect(state.boneyard).toHaveLength(16);

    const burrinho = await joinQueue(await fundedPlayer(), { mode: 'BURRINHO', teamMode: 'DUEL' });
    expect(burrinho.status).toBe(422);
  });

  it('no modo gratuito entra sem gastar chave, sem extrato e sem premio', async () => {
    const original = env.dominoFree;
    env.dominoFree = true;
    try {
      const broke = await fundedPlayer(0);
      expect((await joinQueue(broke, DUEL)).status).toBe(201);
      const left = await request(app).post('/domino/queue/leave').set('Authorization', `Bearer ${broke.token}`);
      expect(left.body.refundedCredits).toBe(0);
      expect(await prisma.transaction.count({ where: { userId: broke.user.id } })).toBe(0);

      const { tableId, players } = await fullTable(DUEL);
      const table = await prisma.dominoTable.findUniqueOrThrow({ where: { id: tableId } });
      expect(table.prizePool.toString()).toBe('0');
      expect(await credits(players[0].user.id)).toBe(5);
    } finally {
      env.dominoFree = original;
    }
  });

  it('nao deixa sair depois que a partida comecou', async () => {
    const { players } = await fullTable();
    const res = await request(app).post('/domino/queue/leave').set('Authorization', `Bearer ${players[0].token}`);
    expect(res.status).toBe(409);
  });

  it('com o domino desligado, so administradores entram na fila', async () => {
    const original = env.dominoEnabled;
    env.dominoEnabled = false;
    try {
      const player = await fundedPlayer();
      const admin = await fundedPlayer();
      await prisma.user.update({ where: { id: admin.user.id }, data: { role: 'ADMIN' } });

      const blocked = await joinQueue(player);
      const allowed = await joinQueue(admin);

      expect([blocked.status, allowed.status]).toEqual([403, 201]);
      expect(await credits(player.user.id)).toBe(5);
    } finally {
      env.dominoEnabled = original;
    }
  });

  it('cancela mesas paradas alem do prazo e devolve as chaves', async () => {
    const player = await fundedPlayer();
    const joined = await joinQueue(player);
    await prisma.dominoTable.update({
      where: { id: joined.body.id },
      data: { createdAt: new Date(Date.now() - (env.dominoQueueTimeoutMinutes + 1) * 60_000) },
    });

    expect(await cancelStaleQueues()).toBe(1);
    expect(await credits(player.user.id)).toBe(5);
    const table = await prisma.dominoTable.findUniqueOrThrow({ where: { id: joined.body.id } });
    expect(table.status).toBe('CANCELLED');
  });
});

describe('Jogadas na mesa', () => {
  it('valida vez, jogador da mesa e pedra', async () => {
    const { tableId, bySeat } = await fullTable();
    const state = await tableState(tableId);
    const current = bySeat(state.currentSeat);
    const other = bySeat((state.currentSeat + 1) % 4);
    const outsider = await fundedPlayer();
    const opening = state.openingTile!;

    const outOfTurn = await move(other, tableId, { type: 'PLAY', tile: state.hands[(state.currentSeat + 1) % 4][0], side: 'LEFT' });
    const notSeated = await move(outsider, tableId, { type: 'PLAY', tile: opening, side: 'LEFT' });
    // Qualquer pedra que nao seja a carroca de saida e invalida na primeira jogada
    const wrongTile = state.hands[state.currentSeat].find((tile) => tile[0] !== opening[0] || tile[1] !== opening[1])!;
    const invalid = await move(current, tableId, { type: 'PLAY', tile: wrongTile, side: 'LEFT' });
    const malformed = await move(current, tableId, { type: 'PLAY', tile: [7, 9], side: 'LEFT' } as unknown as DominoAction);

    expect([outOfTurn.status, notSeated.status, invalid.status, malformed.status]).toEqual([422, 403, 422, 422]);

    const ok = await move(current, tableId, { type: 'PLAY', tile: opening, side: 'LEFT' });
    expect(ok.status).toBe(200);
    expect(ok.body.game.line).toHaveLength(1);
    expect(await prisma.dominoMove.count({ where: { tableId } })).toBeGreaterThanOrEqual(1);
  });

  it('partida completa pela API: termina, paga os vencedores e registra todas as jogadas', async () => {
    for (const choice of [SIX_INDIVIDUAL, { mode: 'BURRINHO', teamMode: 'PAIRS' }, DUEL]) {
      const { tableId, bySeat, players } = await fullTable(choice);
      let state = await tableState(tableId);

      for (let guard = 0; state.status === 'PLAYING'; guard += 1) {
        expect(guard).toBeLessThan(200);
        const res = await move(bySeat(state.currentSeat), tableId, autoAction(state, state.currentSeat));
        expect(res.status).toBe(200);
        state = await tableState(tableId);
      }

      const table = await prisma.dominoTable.findUniqueOrThrow({ where: { id: tableId }, include: { seats: true } });
      expect(table.status).toBe('FINISHED');

      const winners = table.seats.filter((seat) => state.result!.winnerSeats.includes(seat.seat));
      const paidCents = winners.reduce((sum, seat) => sum + Math.round(Number(seat.prizeAmount) * 100), 0);
      expect(paidCents).toBe(Math.round(Number(table.prizePool) * 100));
      expect(await prisma.dominoMove.count({ where: { tableId } })).toBe(state.moveCount);

      const view = await request(app).get(`/domino/tables/${tableId}`).set('Authorization', `Bearer ${players[0].token}`);
      expect(view.body.game.revealedHands).toHaveLength(players.length);
      expect(view.body.status).toBe('FINISHED');

    }
  });
});
