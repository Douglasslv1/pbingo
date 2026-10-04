import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env';
import { registerTestUser } from './helpers';
import { app } from './testApp';

type Player = Awaited<ReturnType<typeof registerTestUser>>;

const auth = (player: Player) => ({ Authorization: `Bearer ${player.token}` });
const venox = async (player: Player) => (await request(app).get('/venox/me').set(auth(player))).body;

/** Partida de damas gratuita entre os dois; `loser` desiste. */
async function damasMatch(winner: Player, loser: Player) {
  let tableId = '';
  for (const player of [winner, loser]) tableId = (await request(app).post('/damas/queue').set(auth(player)).send({ stake: 1 })).body.id;
  expect((await request(app).post(`/damas/tables/${tableId}/moves`).set(auth(loser)).send({ type: 'RESIGN' })).status).toBe(200);
}

const original = { enabled: env.damasEnabled, free: env.boardGamesFree };
beforeEach(() => {
  env.damasEnabled = true;
  env.boardGamesFree = true;
});
afterEach(() => {
  env.damasEnabled = original.enabled;
  env.boardGamesFree = original.free;
});

describe('Venox', () => {
  it('visita diaria rende 2 Venox uma unica vez por dia', async () => {
    const ana = await registerTestUser();
    expect(await venox(ana)).toMatchObject({ balance: 0, dailyClaimed: false });

    const first = await request(app).post('/venox/daily').set(auth(ana));
    expect(first.body).toMatchObject({ claimed: true, balance: 2, dailyClaimed: true });
    const again = await request(app).post('/venox/daily').set(auth(ana));
    expect(again.body).toMatchObject({ claimed: false, balance: 2 });
  });

  it('vitoria rende 10 Venox, ate 3 por dia contra o mesmo adversario; quem perde nao ganha', async () => {
    const [ana, bia, caio] = await Promise.all([1, 2, 3].map(() => registerTestUser()));
    for (let i = 0; i < 4; i += 1) await damasMatch(ana, bia);
    expect((await venox(ana)).balance).toBe(30);
    expect((await venox(bia)).balance).toBe(0);

    await damasMatch(ana, caio);
    expect((await venox(ana)).balance).toBe(40);

    const history = (await request(app).get('/venox/history').set(auth(ana))).body;
    expect(history.items).toHaveLength(4);
    expect(history.items[0]).toMatchObject({ amount: 10, reason: 'WIN' });
  });

  it('exige login', async () => {
    expect((await request(app).get('/venox/me')).status).toBe(401);
  });
});
