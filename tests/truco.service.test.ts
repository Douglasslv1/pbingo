import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env';
import { prisma } from '../src/lib/prisma';
import { handleTurnTimeout } from '../src/modules/tables/tables.service';
import { actingSeat, autoAction } from '../src/modules/truco/truco.engine';
import { TrucoState } from '../src/modules/truco/truco.types';
import { registerTestUser, setCreditBalance } from './helpers';
import { app } from './testApp';

type Player = Awaited<ReturnType<typeof registerTestUser>>;

async function fundedPlayer(credits = 10): Promise<Player> {
  const player = await registerTestUser();
  await setCreditBalance(player.user.id, credits);
  return player;
}

const auth = (player: Player) => ({ Authorization: `Bearer ${player.token}` });
const join = (player: Player, body: Record<string, unknown>) => request(app).post('/truco/queue').set(auth(player)).send(body);
const credits = async (userId: string) => (await prisma.userCredit.findUniqueOrThrow({ where: { userId } })).balance;
const tableState = async (tableId: string) =>
  (await prisma.gameTable.findUniqueOrThrow({ where: { id: tableId } })).state as unknown as TrucoState;

/** Mesa completa ja em jogo. */
async function fullTable(body: Record<string, unknown>) {
  const players = await Promise.all(Array.from({ length: body.teamMode === 'PAIRS' ? 4 : 2 }, () => fundedPlayer()));
  let tableId = '';
  for (const player of players) {
    const res = await join(player, body);
    expect(res.status).toBe(201);
    tableId = res.body.id;
  }
  const seats = await prisma.gameSeat.findMany({ where: { tableId } });
  const bySeat = (seat: number) => players.find((p) => p.user.id === seats.find((s) => s.seat === seat)?.userId)!;
  return { tableId, players, bySeat };
}

const original = { trucoEnabled: env.trucoEnabled, dominoFree: env.dominoFree };
beforeEach(() => {
  env.trucoEnabled = true;
  env.dominoFree = false;
});
afterEach(() => Object.assign(env, original));

describe('Mesas de truco', () => {
  it('mano a mano comeca com 2 jogadores e cobra o valor da mesa (2 chaves)', async () => {
    const { tableId, players } = await fullTable({ teamMode: 'DUEL', stake: 2 });
    const table = await prisma.gameTable.findUniqueOrThrow({ where: { id: tableId } });
    expect(table).toMatchObject({ game: 'TRUCO', mode: 'PAULISTA', status: 'PLAYING', stake: 2 });
    expect(table.prizePool.toString()).toBe((2 * 2 * env.prizeContributionPerTicket).toFixed(1));
    expect(await credits(players[0].user.id)).toBe(8);

    await prisma.user.update({ where: { id: players[1].user.id }, data: { nickname: 'Rei_do_Zap' } });
    const view = await request(app).get('/truco/tables/me').set(auth(players[0]));
    expect(view.body.kind).toBe('TRUCO');
    // Na mesa aparece o apelido (ou "Jogador #0000"), nunca o nome real
    const names = view.body.players.map((player: { name: string }) => player.name);
    expect(names).toContain('Rei_do_Zap');
    expect(names.find((name: string) => name !== 'Rei_do_Zap')).toMatch(/^Jogador #\d{4}$/);
    expect(view.body.game.hand).toHaveLength(3);
    expect(view.body.game.vira).toBeTruthy();
  });

  it('separa as filas por valor da mesa e por formato', async () => {
    const [a, b, c] = await Promise.all([fundedPlayer(), fundedPlayer(), fundedPlayer()]);
    const one = await join(a, { teamMode: 'DUEL', stake: 1 });
    const five = await join(b, { teamMode: 'DUEL', stake: 5 });
    const pairs = await join(c, { teamMode: 'PAIRS', stake: 1 });
    expect(new Set([one.body.id, five.body.id, pairs.body.id]).size).toBe(3);
    expect(five.body.status).toBe('WAITING');

    expect((await join(await fundedPlayer(), { teamMode: 'DUEL', stake: 3 })).status).toBe(422);
    expect((await join(await fundedPlayer(4), { teamMode: 'DUEL', stake: 5 })).status).toBe(400);
  });

  it('cada jogador fica em uma mesa por vez, mesmo entre jogos diferentes', async () => {
    const player = await fundedPlayer();
    await join(player, { teamMode: 'DUEL', stake: 1 });
    const domino = await request(app)
      .post('/domino/queue')
      .set(auth(player))
      .send({ mode: 'SIX_TILES', teamMode: 'DUEL' });
    expect(domino.status).toBe(409);
    expect(domino.body.error).toBe('Você já está em uma mesa de truco');
  });

  it('com o truco desligado, so administradores entram', async () => {
    env.trucoEnabled = false;
    const res = await join(await fundedPlayer(), { teamMode: 'DUEL' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('O truco ainda não está disponível');
  });

  it('valida a vez e a acao: so quem deve agir age, e pedido de truco espera resposta', async () => {
    const { tableId, bySeat } = await fullTable({ teamMode: 'DUEL' });
    const state = await tableState(tableId);
    const acting = bySeat(actingSeat(state));
    const other = bySeat(1 - actingSeat(state));

    const move = (player: Player, action: Record<string, unknown>) =>
      request(app).post(`/truco/tables/${tableId}/moves`).set(auth(player)).send(action);

    expect((await move(other, { type: 'PLAY', index: 0 })).status).toBe(422);
    expect((await move(acting, { type: 'PLAY', index: 7 })).status).toBe(422);
    expect((await move(acting, { type: 'TRUCO' })).status).toBe(200);
    const view = await move(other, { type: 'ACCEPT' });
    expect(view.body.game.value).toBe(3);
  });

  it('quem nao responde ao truco no prazo corre, e o adversario leva o ponto', async () => {
    const { tableId, bySeat } = await fullTable({ teamMode: 'DUEL' });
    const requester = actingSeat(await tableState(tableId));
    await request(app).post(`/truco/tables/${tableId}/moves`).set(auth(bySeat(requester))).send({ type: 'TRUCO' });

    await handleTurnTimeout(tableId, new Date(Date.now() + (env.trucoTurnSeconds + 1) * 1000));
    const state = await tableState(tableId);
    expect(state.score[requester % 2]).toBe(1);
    expect(state.lastHand).toMatchObject({ reason: 'RUN', points: 1 });
    const silent = await prisma.gameSeat.findFirstOrThrow({ where: { tableId, seat: 1 - requester } });
    expect(silent.timeouts).toBe(1);
  });

  it('partida completa: termina em 12, paga o pote a quem venceu (as duas pessoas da dupla) e registra tudo', async () => {
    for (const teamMode of ['DUEL', 'PAIRS']) {
      const { tableId, bySeat, players } = await fullTable({ teamMode, stake: 5 });
      let state = await tableState(tableId);
      for (let guard = 0; state.status === 'PLAYING'; guard += 1) {
        expect(guard).toBeLessThan(1000);
        const seat = actingSeat(state);
        const res = await request(app)
          .post(`/truco/tables/${tableId}/moves`)
          .set(auth(bySeat(seat)))
          .send(autoAction(state, seat));
        expect(res.status).toBe(200);
        state = await tableState(tableId);
      }

      const table = await prisma.gameTable.findUniqueOrThrow({ where: { id: tableId }, include: { seats: true } });
      expect(table.status).toBe('FINISHED');
      const winners = table.seats.filter((seat) => seat.seat % 2 === state.winner);
      expect(winners).toHaveLength(teamMode === 'PAIRS' ? 2 : 1);
      expect(table.seats.filter((seat) => seat.isWinner).map((seat) => seat.seat)).toEqual(winners.map((seat) => seat.seat));
      const paidCents = winners.reduce((sum, seat) => sum + Math.round(Number(seat.prizeAmount) * 100), 0);
      expect(paidCents).toBe(Math.round(Number(table.prizePool) * 100));
      expect(await prisma.gameMove.count({ where: { tableId } })).toBe(state.moveCount);
      // Cada carta jogada fica registrada com a carta (nao so a posicao), a mao e a vira
      const firstPlay = await prisma.gameMove.findFirstOrThrow({
        where: { tableId, action: { path: ['type'], equals: 'PLAY' } },
        orderBy: { moveNumber: 'asc' },
      });
      expect(firstPlay.action).toMatchObject({ hand: expect.any(Number), vira: expect.any(String), card: expect.any(String) });

      const history = await request(app).get('/truco/history/me').set(auth(players[0]));
      expect(history.body.items[0]).toMatchObject({ tableId, stake: 5, score: state.score });
      expect(await prisma.transaction.count({ where: { game: 'TRUCO', type: 'PRIZE_PAYOUT' } })).toBeGreaterThan(0);
    }
  });
});

describe('Mesas por valor no domino', () => {
  it('cobra o valor escolhido quando pago, e no modo gratuito ignora o valor (todos na mesma fila)', async () => {
    const payer = await fundedPlayer();
    const paid = await request(app)
      .post('/domino/queue')
      .set(auth(payer))
      .send({ mode: 'SIX_TILES', teamMode: 'DUEL', stake: 2 });
    expect(paid.body.stake).toBe(2);
    expect(await credits(payer.user.id)).toBe(8);

    env.dominoFree = true;
    const freePlayer = await fundedPlayer();
    const free = await request(app)
      .post('/domino/queue')
      .set(auth(freePlayer))
      .send({ mode: 'SIX_TILES', teamMode: 'DUEL', stake: 5 });
    expect(free.body.stake).toBe(1);
    expect(await credits(freePlayer.user.id)).toBe(10);
  });
});
