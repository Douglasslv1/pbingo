import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env';
import { prisma } from '../src/lib/prisma';
import { handleTurnTimeout } from '../src/modules/tables/tables.service';
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

/** Joga as mesas abertas ate o fim so com jogadas automaticas (tempo esgotado). */
async function autoPlayLiveTables(tournamentId: string) {
  const live = await prisma.tournamentMatch.findMany({ where: { tournamentId, winnerId: null, tableId: { not: null } } });
  for (const match of live) {
    const later = new Date(Date.now() + 1e9);
    while ((await prisma.gameTable.findUniqueOrThrow({ where: { id: match.tableId! } })).status === 'PLAYING') {
      await handleTurnTimeout(match.tableId!, later);
    }
  }
  return live.length;
}

const original = { damas: env.damasEnabled, domino: env.dominoEnabled };
beforeEach(() => {
  env.damasEnabled = true;
  env.dominoEnabled = true;
});
afterEach(() => {
  env.damasEnabled = original.damas;
  env.dominoEnabled = original.domino;
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
    expect((await createTournament({ game: 'TRUCO', teamMode: 'PAIRS', entryFee: 25 })).status).toBe(422);
    expect((await createTournament({ game: 'DOMINO', mode: 'BURRINHO', teamMode: 'DUEL' })).status).toBe(422);
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

  it('dupla: convite pelo apelido, recusa, sorteio de quem entrou sozinho, mesa frente a frente e premio dividido', async () => {
    const id = (await createTournament({ game: 'DOMINO', teamMode: 'PAIRS', entryFee: 20 })).body.id;
    const players = await playersWithVenox(10);
    const [ana, bia, caio, dani] = players;
    await prisma.user.update({ where: { id: bia.user.id }, data: { nickname: 'Bia_Domino' } });
    await prisma.user.update({ where: { id: dani.user.id }, data: { nickname: 'Dani' } });
    const join = (player: Player, body = {}) => request(app).post(`/tournaments/${id}/entry`).set(auth(player)).send(body);

    expect((await join(ana, { partner: 'ninguem' })).status).toBe(404);
    const invited = await join(ana, { partner: 'bia_domino' });
    expect(invited.status).toBe(201);
    expect(await venoxOf(ana)).toBe(90);
    expect(await venoxOf(bia)).toBe(100);
    const biaView = (await request(app).get(`/tournaments/${id}`).set(auth(bia))).body;
    expect(biaView).toMatchObject({ invited: true, joined: false, feePerPlayer: 10 });
    expect(biaView.invitedBy).toMatch(/^Jogador #/);
    expect((await join(bia)).status).toBe(201);
    expect(await venoxOf(bia)).toBe(90);

    await join(caio, { partner: 'Dani' });
    expect((await request(app).delete(`/tournaments/${id}/entry`).set(auth(dani))).status).toBe(200);
    for (const player of players.slice(4)) await join(player);

    // 8 confirmados em equipes (Ana & Bia + 3 sorteadas) e 1 que sobra e recebe o Venox de volta
    await start(id);
    const solos = players.filter((p) => ![ana, bia, dani].includes(p));
    expect((await Promise.all(solos.map(venoxOf))).sort()).toEqual([100, 90, 90, 90, 90, 90, 90].sort());
    const firstTable = await prisma.tournamentMatch.findFirstOrThrow({ where: { tournamentId: id, round: 1, tableId: { not: null } } });
    const seats = await prisma.gameSeat.findMany({ where: { tableId: firstTable.tableId! }, orderBy: { seat: 'asc' } });
    const captainOf = async (userId: string) =>
      (await prisma.tournamentEntry.findFirstOrThrow({ where: { tournamentId: id, userId } })).captainId;
    expect(await captainOf(seats[0].userId)).toBe(await captainOf(seats[2].userId));
    expect(await captainOf(seats[1].userId)).not.toBe(await captainOf(seats[0].userId));

    while ((await autoPlayLiveTables(id)) > 0);
    const tournament = await prisma.tournament.findUniqueOrThrow({ where: { id } });
    expect(tournament).toMatchObject({ status: 'FINISHED', pot: 80 });

    const view = (await request(app).get(`/tournaments/${id}`).set(auth(ana))).body;
    expect(view.podium.map((p: { placement: number; prize: number }) => [p.placement, p.prize])).toEqual([
      [1, 36],
      [2, 18],
      [3, 9],
      [3, 9],
    ]);
    expect(view.podium[0].name).toContain(' & ');
    const total = (await Promise.all(players.map(venoxOf))).reduce((sum, v) => sum + v, 0);
    expect(total).toBe(1000 - 80 + 72);
  });
});
