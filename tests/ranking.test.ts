import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env';
import { prisma } from '../src/lib/prisma';
import { registerTestUser } from './helpers';
import { app } from './testApp';

type Player = Awaited<ReturnType<typeof registerTestUser>>;

/** Partida de truco mano a mano ja encerrada entre dois jogadores. */
async function finishedMatch(winner: Player, loser: Player, finishedAt = new Date()) {
  await prisma.gameTable.create({
    data: {
      game: 'TRUCO',
      mode: 'PAULISTA',
      teamMode: 'DUEL',
      status: 'FINISHED',
      finishedAt,
      seats: {
        create: [
          { userId: winner.user.id, seat: 0, creditsSpent: 1, prizeContribution: 0.8, isWinner: true },
          { userId: loser.user.id, seat: 1, creditsSpent: 1, prizeContribution: 0.8 },
        ],
      },
    },
  });
}

async function matches(winner: Player, loser: Player, count: number, finishedAt?: Date) {
  for (let i = 0; i < count; i += 1) await finishedMatch(winner, loser, finishedAt);
}

const ranking = (game: string, period = 'month', player?: Player) => {
  const req = request(app).get(`/ranking/${game}?period=${period}`);
  return player ? req.set('Authorization', `Bearer ${player.token}`) : req;
};

const originalFree = env.dominoFree;
afterEach(() => {
  env.dominoFree = originalFree;
});

describe('Ranking', () => {
  it('ordena por vitorias e depois por % de vitorias, exige 5 partidas e mostra so o apelido', async () => {
    const [ana, bia, caio, dani] = await Promise.all([1, 2, 3, 4].map(() => registerTestUser()));
    await prisma.user.update({ where: { id: ana.user.id }, data: { nickname: 'Ana_Zap' } });
    await matches(ana, bia, 3); // Ana: 3 vitorias
    await matches(bia, caio, 3); // Bia: 3 vitorias em 6 partidas
    await matches(caio, dani, 1); // Dani: so 1 partida, fica de fora
    await matches(ana, caio, 2); // Ana: 5 vitorias em 5

    const res = await ranking('truco', 'month', bia);
    expect(res.status).toBe(200);
    expect(res.body.entries.map((entry: { name: string; wins: number; matches: number }) => [entry.name, entry.wins, entry.matches])).toEqual([
      ['Ana_Zap', 5, 5],
      [expect.stringMatching(/^Jogador #\d{4}$/), 3, 6],
      [expect.stringMatching(/^Jogador #\d{4}$/), 1, 6],
    ]);
    expect(res.body.entries[0]).toMatchObject({ position: 1, winRate: 100, titles: 0 });
    expect(res.body.me).toMatchObject({ position: 2, isMe: true });
    expect(JSON.stringify(res.body)).not.toContain('prize');
  });

  it('conta no maximo 3 vitorias por dia contra o mesmo adversario', async () => {
    const [ana, bia, caio] = await Promise.all([1, 2, 3].map(() => registerTestUser()));
    await matches(ana, bia, 6);
    await matches(caio, ana, 1);

    const entry = (await ranking('truco')).body.entries.find((e: { matches: number }) => e.matches === 7);
    expect(entry).toMatchObject({ wins: 3, matches: 7 });
  });

  it('o mensal ignora partidas de meses anteriores; o geral conta todas', async () => {
    const [ana, bia] = await Promise.all([registerTestUser(), registerTestUser()]);
    await matches(ana, bia, 3, new Date(Date.now() - 45 * 24 * 60 * 60 * 1000));
    await matches(ana, bia, 2);

    expect((await ranking('truco', 'month')).body.entries).toEqual([]);
    expect((await ranking('truco', 'all')).body.entries[0]).toMatchObject({ matches: 5 });
  });

  it('nos Numeros da sorte conta rodadas vencidas, com 5 rodadas minimas', async () => {
    const [ana, bia] = await Promise.all([registerTestUser(), registerTestUser()]);
    for (let i = 0; i < 5; i += 1) {
      await prisma.round.create({
        data: {
          status: 'FINISHED',
          endedAt: new Date(),
          tickets: {
            create: [
              { userId: ana.user.id, numbersMatrix: [], isWinner: i < 2 },
              { userId: ana.user.id, numbersMatrix: [], isWinner: i < 1 },
              { userId: bia.user.id, numbersMatrix: [], isWinner: false },
            ],
          },
        },
      });
    }
    const entries = (await ranking('bingo')).body.entries;
    expect(entries.map((e: { wins: number; matches: number }) => [e.wins, e.matches])).toEqual([
      [2, 5],
      [0, 5],
    ]);
  });

  it('o domino gratuito tem ranking normal (marcado como gratuito); o ranking e publico', async () => {
    env.dominoFree = true;
    const res = await ranking('domino');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ free: true, minMatches: 5, me: null });
    expect((await ranking('poker')).status).toBe(422);
  });
});
