import { Prisma, TournamentSchedule } from '@prisma/client';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/errors';

/** Brasilia sem horario de verao (desde 2019): UTC-3 fixo. */
const BRT_OFFSET_MS = -3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Uma data a menos de 1 minuto ja nao abre inscricoes: vai para a seguinte. */
const MIN_LEAD_MS = 60 * 1000;

/** Proxima data da agenda depois de `now`: horarios "HH:MM" de Brasilia nos dias escolhidos (vazio = todos). */
export function nextOccurrence(schedule: Pick<TournamentSchedule, 'weekdays' | 'times'>, now = new Date()): Date | null {
  const brtToday = Math.floor((now.getTime() + BRT_OFFSET_MS) / DAY_MS) * DAY_MS;
  for (let day = 0; day <= 7; day += 1) {
    const brtMidnight = brtToday + day * DAY_MS;
    if (schedule.weekdays.length > 0 && !schedule.weekdays.includes(new Date(brtMidnight).getUTCDay())) continue;
    const starts = schedule.times
      .map((time) => {
        const [hours, minutes] = time.split(':').map(Number);
        return brtMidnight + (hours * 60 + minutes) * 60 * 1000 - BRT_OFFSET_MS;
      })
      .filter((start) => start > now.getTime() + MIN_LEAD_MS)
      .sort((a, b) => a - b);
    if (starts.length > 0) return new Date(starts[0]);
  }
  return null;
}

/** Cada agenda ativa fica sempre com um torneio aberto para a sua proxima data. */
export async function ensureScheduledTournaments(now = new Date()): Promise<void> {
  const schedules = await prisma.tournamentSchedule.findMany({
    where: { active: true, tournaments: { none: { status: 'OPEN' } } },
  });
  for (const schedule of schedules) {
    const startsAt = nextOccurrence(schedule, now);
    if (!startsAt) continue;
    const { name, game, mode, teamMode, size, entryFee, id } = schedule;
    try {
      await prisma.tournament.create({ data: { name, game, mode, teamMode, size, entryFee, startsAt, scheduleId: id } });
    } catch (err) {
      // Outro ciclo abriu o torneio desta agenda ao mesmo tempo (indice unico)
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue;
      throw err;
    }
    logger.info('Torneio automático aberto', { scheduleId: id, startsAt });
  }
}

export type ScheduleInput = Omit<TournamentSchedule, 'id' | 'active' | 'createdAt'>;

export function listSchedules() {
  return prisma.tournamentSchedule.findMany({ orderBy: { createdAt: 'asc' } }).then((schedules) =>
    schedules.map((schedule) => ({ ...schedule, nextStartsAt: schedule.active ? nextOccurrence(schedule)?.toISOString() ?? null : null })),
  );
}

export async function createSchedule(input: ScheduleInput) {
  const schedule = await prisma.tournamentSchedule.create({ data: input });
  await ensureScheduledTournaments();
  return schedule;
}

/** Pausar so impede os proximos; o torneio ja aberto continua (o admin pode cancela-lo). */
export async function setScheduleActive(id: string, active: boolean) {
  const schedule = await prisma.tournamentSchedule.update({ where: { id }, data: { active } }).catch(() => null);
  if (!schedule) throw new AppError('Agenda não encontrada', 404);
  if (active) await ensureScheduledTournaments();
  return schedule;
}

export async function deleteSchedule(id: string) {
  const deleted = await prisma.tournamentSchedule.deleteMany({ where: { id } });
  if (deleted.count === 0) throw new AppError('Agenda não encontrada', 404);
}
