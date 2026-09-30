import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env';
import { prisma } from '../src/lib/prisma';
import { RoundEngine } from '../src/modules/rounds/round.engine';
import { openWaitingRound, startOrCancelRound } from '../src/modules/rounds/round.lifecycle';
import { nextRoundSlot } from '../src/modules/rounds/round.schedule';
import { registerTestUser, setCreditBalance } from './helpers';
import { app } from './testApp';

const IN_ONE_HOUR = () => new Date(Date.now() + 60 * 60 * 1000);

function createScheduledRound(scheduledAt: Date) {
  return prisma.round.create({ data: { status: 'WAITING', scheduledAt } });
}

/** Cadastra um jogador com chaves e o coloca na rodada aberta pela API. */
async function playerInRound(tickets = 1) {
  const player = await registerTestUser();
  await setCreditBalance(player.user.id, 10);
  for (let i = 0; i < tickets; i += 1) {
    const res = await request(app).post('/rounds/join').set('Authorization', `Bearer ${player.token}`);
    expect(res.status).toBe(201);
  }
  return player;
}

async function creditBalance(userId: string) {
  return (await prisma.userCredit.findUnique({ where: { userId } }))?.balance;
}

describe('Grade de horarios', () => {
  it('agenda no proximo multiplo de 15 minutos, com ao menos 1 minuto de sala aberta', () => {
    const at = (time: string) => new Date(`2026-09-30T${time}Z`);

    expect(nextRoundSlot(at('20:03:00'), 15)).toEqual(at('20:15:00'));
    expect(nextRoundSlot(at('20:14:00'), 15)).toEqual(at('20:15:00'));
    expect(nextRoundSlot(at('20:14:30'), 15)).toEqual(at('20:30:00'));
    expect(nextRoundSlot(at('20:59:30'), 15)).toEqual(at('21:15:00'));
  });

  it('abre a sala no proximo horario e reaproveita a sala ja aberta', async () => {
    const first = await openWaitingRound(new Date('2026-09-30T20:03:00Z'));
    const again = await openWaitingRound(new Date('2026-09-30T20:05:00Z'));

    expect(first.scheduledAt).toEqual(new Date('2026-09-30T20:15:00Z'));
    expect(again.id).toBe(first.id);
  });
});

describe('Inicio ou cancelamento no horario marcado', () => {
  it('comeca o sorteio com o minimo de jogadores diferentes', async () => {
    const round = await createScheduledRound(IN_ONE_HOUR());
    for (let i = 0; i < env.minPlayersPerRound; i += 1) {
      await playerInRound();
    }

    expect(await startOrCancelRound(round.id)).toEqual({ outcome: 'started' });
    const started = await prisma.round.findUnique({ where: { id: round.id } });
    expect(started?.status).toBe('IN_PROGRESS');
  });

  it('cancela e devolve todas as chaves quando faltam jogadores (varias cartelas do mesmo jogador contam como um)', async () => {
    const round = await createScheduledRound(IN_ONE_HOUR());
    const multi = await playerInRound(env.minPlayersPerRound);
    const single = await playerInRound();

    const result = await startOrCancelRound(round.id);

    expect(result).toEqual({ outcome: 'cancelled', playersCount: 2 });
    expect(await creditBalance(multi.user.id)).toBe(10);
    expect(await creditBalance(single.user.id)).toBe(10);

    const cancelled = await prisma.round.findUnique({ where: { id: round.id } });
    expect(cancelled?.status).toBe('CANCELLED');
    expect(cancelled?.accumulatedPrize.toString()).toBe('0');

    const refunds = await prisma.transaction.count({ where: { type: 'KEY_REFUND' } });
    expect(refunds).toBe(env.minPlayersPerRound + 1);
  });

  it('nao decide duas vezes a mesma rodada', async () => {
    const round = await createScheduledRound(IN_ONE_HOUR());
    await playerInRound();

    const [first, second] = await Promise.all([startOrCancelRound(round.id), startOrCancelRound(round.id)]);

    expect([first.outcome, second.outcome].sort()).toEqual(['cancelled', 'skipped']);
    expect(await prisma.transaction.count({ where: { type: 'KEY_REFUND' } })).toBe(1);
  });

  it('ao reiniciar o servidor, resolve a rodada cujo horario ja passou', async () => {
    const round = await createScheduledRound(new Date(Date.now() - 60_000));
    const player = await playerInRound();
    const engine = new RoundEngine();

    try {
      await engine.start();
      await expect.poll(async () => (await prisma.round.findUnique({ where: { id: round.id } }))?.status).toBe(
        'CANCELLED',
      );
      expect(await creditBalance(player.user.id)).toBe(10);
    } finally {
      engine.stop();
    }
  });
});

describe('Sair da rodada antes do inicio', () => {
  it('devolve a chave e tira a contribuicao do premio', async () => {
    await createScheduledRound(IN_ONE_HOUR());
    const stays = await playerInRound();
    const leaves = await playerInRound();

    const res = await request(app).post('/rounds/leave').set('Authorization', `Bearer ${leaves.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ refundedCredits: 1, playersCount: 1 });
    expect(res.body.accumulatedPrize).toBe(env.prizeContributionPerTicket.toString());
    expect(await creditBalance(leaves.user.id)).toBe(10);
    expect(await creditBalance(stays.user.id)).toBe(9);
    expect(await prisma.ticket.count({ where: { userId: leaves.user.id } })).toBe(0);
  });

  it('recusa sair quando o jogador nao esta na sala ou a rodada ja comecou', async () => {
    const round = await createScheduledRound(IN_ONE_HOUR());
    const outsider = await registerTestUser();
    const player = await playerInRound();
    await prisma.round.update({ where: { id: round.id }, data: { status: 'IN_PROGRESS' } });

    const notIn = await request(app).post('/rounds/leave').set('Authorization', `Bearer ${outsider.token}`);
    const tooLate = await request(app).post('/rounds/leave').set('Authorization', `Bearer ${player.token}`);

    expect([notIn.status, tooLate.status]).toEqual([409, 409]);
    expect(await creditBalance(player.user.id)).toBe(9);
  });
});

describe('Rodada atual e regras publicas', () => {
  it('mostra horario marcado, jogadores e minimo', async () => {
    const scheduledAt = IN_ONE_HOUR();
    await createScheduledRound(scheduledAt);
    await playerInRound();

    const res = await request(app).get('/rounds/current');

    expect(res.body).toMatchObject({
      status: 'WAITING',
      waitingEndsAt: scheduledAt.toISOString(),
      playersCount: 1,
      minPlayers: env.minPlayersPerRound,
    });
  });

  it('expoe preco da chave e regras em /config', async () => {
    const res = await request(app).get('/config');

    expect(res.body).toMatchObject({
      creditPriceBrl: env.creditPriceBrl,
      minPlayersPerRound: env.minPlayersPerRound,
      roundIntervalMinutes: env.roundIntervalMinutes,
    });
  });
});
