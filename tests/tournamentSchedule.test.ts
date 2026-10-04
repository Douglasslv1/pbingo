import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { nextOccurrence } from '../src/modules/tournaments/tournament.schedule';
import { tournamentTick } from '../src/modules/tournaments/tournament.service';
import { makeAdmin, registerTestUser } from './helpers';
import { app } from './testApp';

// 2026-10-04 e um domingo; 15:00 em Brasilia = 18:00 UTC
const sundayAfternoon = new Date('2026-10-04T18:00:00Z');

async function admin() {
  const user = await registerTestUser();
  await makeAdmin(user.user.id);
  return { Authorization: `Bearer ${user.token}` };
}

const schedule = { name: 'Diário', game: 'TRUCO', size: 16, entryFee: 50, times: ['21:00'] };

describe('Agendas de torneios automaticos', () => {
  it('proxima data no horario de Brasilia, nos dias escolhidos', () => {
    expect(nextOccurrence({ weekdays: [], times: ['21:00'] }, sundayAfternoon)).toEqual(new Date('2026-10-05T00:00:00Z'));
    expect(nextOccurrence({ weekdays: [], times: ['09:00'] }, sundayAfternoon)).toEqual(new Date('2026-10-05T12:00:00Z'));
    // Sabado 20h: o proximo sabado e 10/10
    expect(nextOccurrence({ weekdays: [6], times: ['20:00'] }, sundayAfternoon)).toEqual(new Date('2026-10-10T23:00:00Z'));
    // A cada 2h: depois das 15h vem 16h
    const everyTwoHours = Array.from({ length: 12 }, (_, i) => `${String(i * 2).padStart(2, '0')}:00`);
    expect(nextOccurrence({ weekdays: [], times: everyTwoHours }, sundayAfternoon)).toEqual(new Date('2026-10-04T19:00:00Z'));
    // Menos de 1 minuto para a data: vai para a seguinte
    expect(nextOccurrence({ weekdays: [], times: ['15:00', '15:30'] }, new Date('2026-10-04T17:59:30Z'))).toEqual(
      new Date('2026-10-04T18:30:00Z'),
    );
  });

  it('admin cria a agenda, que abre o proximo torneio; ao largar, ja abre o seguinte', async () => {
    const headers = await admin();
    expect((await request(app).post('/admin/tournaments/schedules').set(headers).send({ ...schedule, times: ['25:00'] })).status).toBe(422);
    expect((await request(app).post('/admin/tournaments/schedules').set(headers).send({ ...schedule, times: [] })).status).toBe(422);

    const created = await request(app).post('/admin/tournaments/schedules').set(headers).send(schedule);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ game: 'TRUCO', mode: 'PAULISTA', teamMode: 'DUEL', weekdays: [], times: ['21:00'] });

    const open = await prisma.tournament.findFirstOrThrow({ where: { scheduleId: created.body.id } });
    expect(open).toMatchObject({ name: 'Diário', status: 'OPEN', size: 16, entryFee: 50 });
    expect(open.startsAt).toEqual(nextOccurrence(created.body));

    // Ciclo repetido nao duplica
    await tournamentTick();
    expect(await prisma.tournament.count({ where: { scheduleId: created.body.id } })).toBe(1);

    // Chegou a hora: sem inscritos e cancelado, e a agenda abre o proximo
    await prisma.tournament.update({ where: { id: open.id }, data: { startsAt: new Date(Date.now() - 1000) } });
    await tournamentTick();
    const all = await prisma.tournament.findMany({ where: { scheduleId: created.body.id }, orderBy: { createdAt: 'asc' } });
    expect(all.map((t) => t.status)).toEqual(['CANCELLED', 'OPEN']);

    const listed = (await request(app).get('/admin/tournaments/schedules').set(headers)).body;
    expect(listed[0].nextStartsAt).toBe(all[1].startsAt.toISOString());
  });

  it('pausada nao abre novos; reativada volta a abrir; excluida some da lista', async () => {
    const headers = await admin();
    const { id } = (await request(app).post('/admin/tournaments/schedules').set(headers).send(schedule)).body;
    const open = await prisma.tournament.findFirstOrThrow({ where: { scheduleId: id } });

    expect((await request(app).patch(`/admin/tournaments/schedules/${id}`).set(headers).send({ active: false })).status).toBe(200);
    await request(app).post(`/admin/tournaments/${open.id}/cancel`).set(headers);
    await tournamentTick();
    expect(await prisma.tournament.count({ where: { scheduleId: id, status: 'OPEN' } })).toBe(0);

    await request(app).patch(`/admin/tournaments/schedules/${id}`).set(headers).send({ active: true });
    expect(await prisma.tournament.count({ where: { scheduleId: id, status: 'OPEN' } })).toBe(1);

    expect((await request(app).delete(`/admin/tournaments/schedules/${id}`).set(headers)).status).toBe(204);
    expect((await request(app).get('/admin/tournaments/schedules').set(headers)).body).toEqual([]);
    // O torneio ja aberto continua, so sem agenda
    expect(await prisma.tournament.count({ where: { status: 'OPEN', scheduleId: null } })).toBe(1);
  });

  it('so admin gerencia agendas', async () => {
    const player = await registerTestUser();
    expect((await request(app).get('/admin/tournaments/schedules').set('Authorization', `Bearer ${player.token}`)).status).toBe(403);
  });
});
