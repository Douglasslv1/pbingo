import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env';
import { prisma } from '../src/lib/prisma';
import { dieAt, LudoState } from '../src/modules/ludo/ludo.engine';
import { handleTurnTimeout } from '../src/modules/tables/tables.service';
import { makeAdmin, registerTestUser } from './helpers';
import { app } from './testApp';

type Player = Awaited<ReturnType<typeof registerTestUser>>;

const auth = (player: Player) => ({ Authorization: `Bearer ${player.token}` });

/** Mesa de Ludo cheia; devolve os jogadores pela ordem dos lugares. */
async function startTable(teamMode: 'DUEL' | 'INDIVIDUAL') {
  const players = await Promise.all(Array.from({ length: teamMode === 'DUEL' ? 2 : 4 }, () => registerTestUser()));
  let tableId = '';
  for (const player of players) {
    const res = await request(app).post('/ludo/queue').set(auth(player)).send({ teamMode });
    expect(res.status).toBe(201);
    tableId = res.body.id;
  }
  const seats = await prisma.gameSeat.findMany({ where: { tableId }, orderBy: { seat: 'asc' } });
  const bySeat = seats.map((seat) => players.find((player) => player.user.id === seat.userId)!);
  const act = (player: Player, action: Record<string, unknown>) =>
    request(app).post(`/ludo/tables/${tableId}/moves`).set(auth(player)).send(action);
  const state = async () => (await prisma.gameTable.findUniqueOrThrow({ where: { id: tableId } })).state as unknown as LudoState;
  return { tableId, bySeat, act, state };
}

const original = { enabled: env.ludoEnabled, free: env.ludoFree };
beforeEach(() => {
  env.ludoEnabled = true;
  env.ludoFree = true;
});
afterEach(() => {
  env.ludoEnabled = original.enabled;
  env.ludoFree = original.free;
});

describe('Ludo nas mesas', () => {
  it('fechado ao publico ate LUDO_ENABLED; admin entra mesmo assim', async () => {
    env.ludoEnabled = false;
    const player = await registerTestUser();
    const res = await request(app).post('/ludo/queue').set(auth(player)).send({ teamMode: 'DUEL' });
    expect(res.status).toBe(403);

    const admin = await registerTestUser();
    await makeAdmin(admin.user.id);
    expect((await request(app).post('/ludo/queue').set(auth(admin)).send({ teamMode: 'DUEL' })).status).toBe(201);
  });

  it('gratuito: mesa de 2 ou de 4 comeca cheia, sem cobrar, e todos veem as pecas', async () => {
    const duel = await startTable('DUEL');
    const table = await prisma.gameTable.findUniqueOrThrow({ where: { id: duel.tableId } });
    expect(table).toMatchObject({ game: 'LUDO', mode: 'CLASSICO', teamMode: 'DUEL', status: 'PLAYING' });
    expect(table.prizePool.toString()).toBe('0');

    const four = await startTable('INDIVIDUAL');
    const view = (await request(app).get('/ludo/tables/me').set(auth(four.bySeat[2]))).body.game;
    expect(view).toMatchObject({ colors: [0, 1, 2, 3], turn: 0, phase: 'ROLL', seed: null });
    expect(view.pieces).toHaveLength(4);
    expect(await prisma.transaction.count()).toBe(0);
  });

  it('so quem esta na vez rola o dado; o valor vem da semente e fica no registro', async () => {
    const { tableId, bySeat, act, state } = await startTable('DUEL');
    expect((await act(bySeat[1], { type: 'ROLL' })).status).toBe(422);

    const { seed } = await state();
    expect((await act(bySeat[0], { type: 'ROLL' })).status).toBe(200);
    const after = await state();
    expect(after.lastRoll).toEqual({ seat: 0, value: dieAt(seed, 0) });

    const [first] = await prisma.gameMove.findMany({ where: { tableId }, orderBy: { moveNumber: 'asc' } });
    expect(first.action).toEqual({ type: 'ROLL', value: dieAt(seed, 0) });
  });

  it('o cliente nao escolhe o dado nem a casa: campos extras sao ignorados e peca invalida e recusada', async () => {
    const { bySeat, act, state } = await startTable('DUEL');
    expect((await act(bySeat[0], { type: 'MOVE', piece: 0, to: 56 })).status).toBe(422);
    expect((await act(bySeat[0], { type: 'MOVE', piece: 9 })).status).toBe(422);
    expect((await state()).pieces[0]).toEqual([-1, -1, -1, -1]);
  });

  it('cliques simultaneos no dado: so um e aceito', async () => {
    const { tableId, bySeat, act, state } = await startTable('DUEL');
    // Um 6 tiraria a peca da base sozinho e daria outra jogada de verdade: fixa um dado que passa a vez
    let seed = 0;
    while (dieAt(`s${seed}`, 0) === 6) seed++;
    await prisma.gameTable.update({ where: { id: tableId }, data: { state: { ...(await state()), seed: `s${seed}` } } });

    const results = await Promise.all([act(bySeat[0], { type: 'ROLL' }), act(bySeat[0], { type: 'ROLL' })]);
    const after = await state();
    expect(results.filter((res) => res.status === 200)).toHaveLength(1);
    expect(after.rolls).toBe(1);
  });

  it('tempo esgotado: o sistema rola o dado pelo jogador', async () => {
    const { tableId, state } = await startTable('DUEL');
    await handleTurnTimeout(tableId, new Date(Date.now() + (env.ludoTurnSeconds + 1) * 1000));
    expect((await state()).rolls).toBe(1);
  });

  it('o ranking do Ludo vale para as partidas gratuitas', async () => {
    const res = await request(app).get('/ranking/ludo');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ free: true });
  });
});
