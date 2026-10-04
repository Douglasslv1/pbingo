import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env';
import { prisma } from '../src/lib/prisma';
import { prizesFor, tournamentTick } from '../src/modules/tournaments/tournament.service';
import { makeAdmin, registerTestUser } from './helpers';
import { app } from './testApp';

type Player = Awaited<ReturnType<typeof registerTestUser>>;

const auth = (player: Player) => ({ Authorization: `Bearer ${player.token}` });
const venoxOf = async (player: Player) => (await prisma.user.findUniqueOrThrow({ where: { id: player.user.id } })).venox;

async function playersWithVenox(count: number, venox = 100): Promise<Player[]> {
  const players = await Promise.all(Array.from({ length: count }, () => registerTestUser()));
  await prisma.user.updateMany({ where: { id: { in: players.map((p) => p.user.id) } }, data: { venox } });
  return players;
}

async function createTournament(body: Record<string, unknown> = {}) {
  const admin = await registerTestUser();
  await makeAdmin(admin.user.id);
  return request(app)
    .post('/admin/tournaments')
    .set(auth(admin))
    .send({ name: 'Relâmpago', game: 'DAMAS', size: 8, entryFee: 20, startsAt: new Date(Date.now() + 60_000), ...body });
}

/** Chega o horario de largada. */
async function start(tournamentId: string) {
  await prisma.tournament.update({ where: { id: tournamentId }, data: { startsAt: new Date(Date.now() - 1000) } });
  await tournamentTick();
}

/** Joga as partidas abertas: em cada uma, o jogador da posicao 1 desiste. */
async function playLiveMatches(tournamentId: string, players: Player[]) {
  const live = await prisma.tournamentMatch.findMany({ where: { tournamentId, winnerId: null, tableId: { not: null } } });
  for (const match of live) {
    const loser = players.find((p) => p.user.id === match.player1Id)!;
    const res = await request(app).post(`/damas/tables/${match.tableId}/moves`).set(auth(loser)).send({ type: 'RESIGN' });
    expect(res.status).toBe(200);
  }
  return live.length;
}

const original = env.damasEnabled;
beforeEach(() => {
  env.damasEnabled = true;
});
afterEach(() => {
  env.damasEnabled = original;
});

describe('Torneios', () => {
  it('premios: 10% da casa e 50/25/12,5/12,5 do restante', () => {
    expect(prizesFor(800)).toEqual([360, 180, 90, 90]);
    expect(prizesFor(100)).toEqual([46, 22, 11, 11]);
  });

  it('so admin cria, com jogo, vagas e modo validos', async () => {
    const player = await registerTestUser();
    expect((await request(app).post('/admin/tournaments').set(auth(player)).send({})).status).toBe(403);
    expect((await createTournament({ size: 10 })).status).toBe(422);
    expect((await createTournament({ game: 'LUDO', mode: 'TURBO' })).status).toBe(422);
    const res = await createTournament({ game: 'LUDO' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ game: 'LUDO', mode: 'CLASSICO', teamMode: 'DUEL', status: 'OPEN' });
  });

  it('inscricao cobra Venox, desistir devolve, e nao inscreve sem saldo, repetido ou lotado', async () => {
    const id = (await createTournament()).body.id;
    const [ana, pobre] = await playersWithVenox(2, 25);
    await prisma.user.update({ where: { id: pobre.user.id }, data: { venox: 10 } });

    expect((await request(app).post(`/tournaments/${id}/entry`).set(auth(ana))).status).toBe(201);
    expect(await venoxOf(ana)).toBe(5);
    expect((await request(app).post(`/tournaments/${id}/entry`).set(auth(ana))).status).toBe(409);
    expect((await request(app).post(`/tournaments/${id}/entry`).set(auth(pobre))).status).toBe(400);

    const left = await request(app).delete(`/tournaments/${id}/entry`).set(auth(ana));
    expect(left.body).toMatchObject({ players: 0, pot: 0, joined: false });
    expect(await venoxOf(ana)).toBe(25);
    // Inscrever de novo depois de desistir cobra outra vez (e devolve outra vez)
    expect((await request(app).post(`/tournaments/${id}/entry`).set(auth(ana))).status).toBe(201);
    expect(await venoxOf(ana)).toBe(5);
  });

  it('com menos de 4 inscritos e cancelado na largada e devolve o Venox', async () => {
    const id = (await createTournament()).body.id;
    const players = await playersWithVenox(3);
    for (const player of players) await request(app).post(`/tournaments/${id}/entry`).set(auth(player));

    await start(id);
    expect((await prisma.tournament.findUniqueOrThrow({ where: { id } })).status).toBe('CANCELLED');
    expect(await Promise.all(players.map(venoxOf))).toEqual([100, 100, 100]);
  });

  it('5 inscritos: chave de 8 com 3 isencoes aos primeiros, joga ate a final e paga o podio', async () => {
    const id = (await createTournament()).body.id;
    const players = await playersWithVenox(5);
    for (const player of players) await request(app).post(`/tournaments/${id}/entry`).set(auth(player));

    await start(id);
    const firstRound = await prisma.tournamentMatch.findMany({ where: { tournamentId: id, round: 1 } });
    expect(firstRound).toHaveLength(4);
    const byes = firstRound.filter((match) => match.player1Id === null).map((match) => match.player0Id).sort();
    expect(byes).toEqual(players.slice(0, 3).map((p) => p.user.id).sort());

    let rounds = 0;
    while ((await playLiveMatches(id, players)) > 0) rounds += 1;
    expect(rounds).toBe(3);

    const tournament = await prisma.tournament.findUniqueOrThrow({ where: { id } });
    expect(tournament).toMatchObject({ status: 'FINISHED', pot: 100 });
    const view = (await request(app).get(`/tournaments/${id}`).set(auth(players[0]))).body;
    expect(view.podium.map((p: { placement: number; prize: number }) => [p.placement, p.prize])).toEqual([
      [1, 46],
      [2, 22],
      [3, 11],
      [3, 11],
    ]);
    expect(view.rounds.map((round: unknown[]) => round.length)).toEqual([4, 2, 1]);

    // Venox total: 500 - 100 de inscricao + 90 de premio; as vitorias do torneio nao rendem os 10 por vitoria
    const total = (await Promise.all(players.map(venoxOf))).reduce((sum, v) => sum + v, 0);
    expect(total).toBe(490);
  });

  it('admin cancela antes do inicio e todos recebem o Venox de volta', async () => {
    const admin = await registerTestUser();
    await makeAdmin(admin.user.id);
    const id = (await createTournament()).body.id;
    const [ana] = await playersWithVenox(1);
    await request(app).post(`/tournaments/${id}/entry`).set(auth(ana));

    expect((await request(app).post(`/admin/tournaments/${id}/cancel`).set(auth(admin))).status).toBe(204);
    expect(await venoxOf(ana)).toBe(100);
    expect((await request(app).get('/tournaments')).body[0]).toMatchObject({ status: 'CANCELLED' });
  });
});
