import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env';
import { prisma } from '../src/lib/prisma';
import { handleTurnTimeout } from '../src/modules/tables/tables.service';
import { registerTestUser, setCreditBalance } from './helpers';
import { app } from './testApp';

type Player = Awaited<ReturnType<typeof registerTestUser>>;

const auth = (player: Player) => ({ Authorization: `Bearer ${player.token}` });
const sq = (name: string) => (8 - Number(name[1])) * 8 + 'abcdefgh'.indexOf(name[0]);

/** Mesa de damas ou xadrez com os dois jogadores; devolve quem joga de brancas e de pretas. */
async function startTable(game: 'damas' | 'xadrez') {
  const players = [await registerTestUser(), await registerTestUser()];
  await Promise.all(players.map((player) => setCreditBalance(player.user.id, 10)));
  let tableId = '';
  for (const player of players) {
    const res = await request(app).post(`/${game}/queue`).set(auth(player)).send({ stake: 5 });
    expect(res.status).toBe(201);
    tableId = res.body.id;
  }
  const views = await Promise.all(players.map((player) => request(app).get(`/${game}/tables/me`).set(auth(player))));
  const white = players[views.findIndex((view) => view.body.game.myColor === 'w')];
  const black = players.find((player) => player !== white)!;
  const move = (player: Player, action: Record<string, unknown>) =>
    request(app).post(`/${game}/tables/${tableId}/moves`).set(auth(player)).send(action);
  return { tableId, white, black, move };
}

const original = { damas: env.damasEnabled, xadrez: env.xadrezEnabled, free: env.boardGamesFree };
beforeEach(() => {
  env.damasEnabled = true;
  env.xadrezEnabled = true;
});
afterEach(() => {
  env.damasEnabled = original.damas;
  env.xadrezEnabled = original.xadrez;
  env.boardGamesFree = original.free;
});

describe('Damas e xadrez nas mesas', () => {
  it('gratuitos: mesa de 2 sem cobrar, cores sorteadas e so as brancas veem lances na abertura', async () => {
    const { tableId, white, black } = await startTable('damas');
    const table = await prisma.gameTable.findUniqueOrThrow({ where: { id: tableId } });
    expect(table).toMatchObject({ game: 'DAMAS', mode: 'BRASILEIRA', teamMode: 'DUEL', status: 'PLAYING', stake: 1 });
    expect(table.prizePool.toString()).toBe('0');

    const whiteView = (await request(app).get('/damas/tables/me').set(auth(white))).body.game;
    const blackView = (await request(app).get('/damas/tables/me').set(auth(black))).body.game;
    expect(whiteView.legalPaths).toHaveLength(7);
    expect(blackView.legalPaths).toEqual([]);
    expect(await prisma.transaction.count()).toBe(0);
  });

  it('xadrez pela API: lances validados, mate encerra e marca o vencedor', async () => {
    const { tableId, white, black, move } = await startTable('xadrez');
    expect((await move(black, { type: 'MOVE', from: sq('e7'), to: sq('e5') })).status).toBe(422);
    expect((await move(white, { type: 'MOVE', from: sq('e2'), to: sq('e5') })).status).toBe(422);

    // 1.e4 g5 2.d4 f6 3.Dh5#
    const fool = [
      [black, 'g7', 'g5'],
      [white, 'd2', 'd4'],
      [black, 'f7', 'f6'],
      [white, 'd1', 'h5'],
    ] as const;
    expect((await move(white, { type: 'MOVE', from: sq('e2'), to: sq('e4') })).status).toBe(200);
    for (const [player, from, to] of fool) {
      const res = await move(player, { type: 'MOVE', from: sq(from), to: sq(to) });
      expect(res.status).toBe(200);
    }

    const table = await prisma.gameTable.findUniqueOrThrow({ where: { id: tableId }, include: { seats: true } });
    expect(table.status).toBe('FINISHED');
    const winner = table.seats.find((seat) => seat.isWinner);
    expect(winner?.userId).toBe(white.user.id);
  });

  it('desistir encerra a partida com vitoria do adversario, mesmo fora da vez', async () => {
    const { tableId, black, move } = await startTable('xadrez');
    expect((await move(black, { type: 'RESIGN' })).status).toBe(200);
    const table = await prisma.gameTable.findUniqueOrThrow({ where: { id: tableId }, include: { seats: true } });
    expect(table.status).toBe('FINISHED');
    expect(table.seats.find((seat) => seat.isWinner)?.userId).not.toBe(black.user.id);
  });

  it('tempo esgotado e derrota (sem lance automatico)', async () => {
    const { tableId, white } = await startTable('damas');
    await handleTurnTimeout(tableId, new Date(Date.now() + (env.boardTurnSeconds + 1) * 1000));
    const table = await prisma.gameTable.findUniqueOrThrow({ where: { id: tableId }, include: { seats: true } });
    expect(table.status).toBe('FINISHED');
    expect((table.state as { result: unknown }).result).toEqual({ winner: 'b', reason: 'TIMEOUT' });
    expect(table.seats.find((seat) => seat.userId === white.user.id)?.isWinner).toBe(false);
  });

  it('pago: empate divide o pote entre os dois; vitoria e cobrada e paga como nas outras mesas', async () => {
    env.boardGamesFree = false;
    const { tableId, white, move } = await startTable('xadrez');
    const table = await prisma.gameTable.findUniqueOrThrow({ where: { id: tableId } });
    expect(table.stake).toBe(5);

    // Forca um empate por material insuficiente: so os reis no tabuleiro, brancas jogam
    const state = table.state as { board: Array<string | null> };
    const board = Array(64).fill(null);
    board[sq('e1')] = 'K';
    board[sq('e8')] = 'k';
    board[sq('d2')] = 'n';
    await prisma.gameTable.update({ where: { id: tableId }, data: { state: { ...state, board, castling: '' } } });
    // O rei branco captura o cavalo: sobram so os dois reis
    expect((await move(white, { type: 'MOVE', from: sq('e1'), to: sq('d2') })).status).toBe(200);

    const finished = await prisma.gameTable.findUniqueOrThrow({ where: { id: tableId }, include: { seats: true } });
    expect((finished.state as { result: unknown }).result).toEqual({ winner: null, reason: 'MATERIAL' });
    const paid = finished.seats.map((seat) => Number(seat.prizeAmount));
    expect(paid[0] + paid[1]).toBeCloseTo(Number(finished.prizePool));
    expect(finished.seats.every((seat) => !seat.isWinner)).toBe(true);
  });

  it('o ranking das damas e do xadrez vale para as partidas gratuitas', async () => {
    env.boardGamesFree = true;
    const res = await request(app).get('/ranking/xadrez');
    expect(res.body).toMatchObject({ free: true, maxDailyWinsVsSame: 3 });
  });
});
