import { randomInt } from 'crypto';
import { Prisma, Tournament, TournamentMatch } from '@prisma/client';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/errors';
import { emitToUser } from '../../websocket/socket';
import { displayName } from '../profile/nickname';
import { announceTables, startTournamentTable } from '../tables/tables.service';
import { GameName } from '../tables/tables.types';
import { addVenox } from '../venox/venox.service';

type Tx = Prisma.TransactionClient;

/** Parte do pote que sai de circulacao (segura a inflacao do Venox). */
export const HOUSE_CUT = 0.1;
/** Divisao do restante: campeao, vice e os dois semifinalistas. */
export const PRIZE_SHARES = [0.5, 0.25, 0.125, 0.125];
/** Abaixo disso o torneio e cancelado na largada e as inscricoes devolvidas. */
export const MIN_PLAYERS = 4;
export const TOURNAMENT_SIZES = [8, 16, 32] as const;

/** Formatos mano a mano aceitos por jogo (duplas e grupos de 4 ficam para a fase 3). */
export const TOURNAMENT_FORMATS: Record<GameName, string[]> = {
  DOMINO: ['SIX_TILES'],
  TRUCO: ['PAULISTA'],
  DAMAS: ['BRASILEIRA'],
  XADREZ: ['CLASSICO'],
  LUDO: ['CLASSICO', 'ARENA'],
};

/** Premios em Venox para um pote: 10% da casa e o resto 50/25/12,5/12,5 (sobras de arredondamento ao campeao). */
export function prizesFor(pot: number): number[] {
  const pool = pot - Math.floor(pot * HOUSE_CUT);
  const prizes = PRIZE_SHARES.map((share) => Math.floor(pool * share));
  prizes[0] += pool - prizes.reduce((sum, prize) => sum + prize, 0);
  return prizes;
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

async function lockTournament(tx: Tx, id: string): Promise<Tournament> {
  await tx.$queryRaw`SELECT id FROM tournaments WHERE id = ${id}::uuid FOR UPDATE`;
  const tournament = await tx.tournament.findUnique({ where: { id } });
  if (!tournament) throw new AppError('Torneio não encontrado', 404);
  return tournament;
}

const refund = (tx: Tx, tournament: Tournament, entry: { id: string; userId: string }) =>
  tournament.entryFee > 0 ? addVenox(tx, entry.userId, tournament.entryFee, 'TOURNAMENT_REFUND', entry.id) : null;

/** Avisa os inscritos que o torneio mudou (inscricoes, chave, resultado). */
async function notifyEntrants(tournamentId: string): Promise<void> {
  const entries = await prisma.tournamentEntry.findMany({ where: { tournamentId }, select: { userId: true } });
  entries.forEach((entry) => emitToUser(entry.userId, 'tournament:changed', { id: tournamentId }));
}

export interface TournamentInput {
  name: string;
  game: GameName;
  mode: string;
  size: (typeof TOURNAMENT_SIZES)[number];
  entryFee: number;
  startsAt: Date;
}

export function createTournament(input: TournamentInput) {
  return prisma.tournament.create({ data: { ...input, teamMode: 'DUEL' } });
}

/** Inscricao paga em Venox, ate a largada e enquanto houver vaga. */
export async function joinTournament(userId: string, id: string) {
  await prisma.$transaction(async (tx) => {
    const tournament = await lockTournament(tx, id);
    if (tournament.status !== 'OPEN' || tournament.startsAt <= new Date()) {
      throw new AppError('As inscrições deste torneio estão encerradas', 409);
    }
    const entries = await tx.tournamentEntry.findMany({ where: { tournamentId: id }, select: { userId: true } });
    if (entries.some((entry) => entry.userId === userId)) throw new AppError('Você já está inscrito', 409);
    if (entries.length >= tournament.size) throw new AppError('Torneio lotado', 409);

    const [{ venox }] = await tx.$queryRaw<Array<{ venox: number }>>`SELECT venox FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
    if (venox < tournament.entryFee) throw new AppError('Venox insuficiente para a inscrição', 400);

    const entry = await tx.tournamentEntry.create({ data: { tournamentId: id, userId } });
    if (tournament.entryFee > 0) await addVenox(tx, userId, -tournament.entryFee, 'TOURNAMENT_ENTRY', entry.id);
    await tx.tournament.update({ where: { id }, data: { pot: { increment: tournament.entryFee } } });
  });
  await notifyEntrants(id);
  return getTournament(id, userId);
}

/** Desiste antes da largada, com o Venox de volta. */
export async function leaveTournament(userId: string, id: string) {
  await prisma.$transaction(async (tx) => {
    const tournament = await lockTournament(tx, id);
    if (tournament.status !== 'OPEN') throw new AppError('O torneio já começou', 409);
    const entry = await tx.tournamentEntry.findUnique({ where: { tournamentId_userId: { tournamentId: id, userId } } });
    if (!entry) throw new AppError('Você não está inscrito', 409);

    await tx.tournamentEntry.delete({ where: { id: entry.id } });
    await refund(tx, tournament, entry);
    await tx.tournament.update({ where: { id }, data: { pot: { decrement: tournament.entryFee } } });
  });
  await notifyEntrants(id);
  return getTournament(id, userId);
}

async function cancelOpen(tx: Tx, tournament: Tournament): Promise<void> {
  const entries = await tx.tournamentEntry.findMany({ where: { tournamentId: tournament.id } });
  for (const entry of entries) await refund(tx, tournament, entry);
  await tx.tournament.update({ where: { id: tournament.id }, data: { status: 'CANCELLED', pot: 0, finishedAt: new Date() } });
}

/** Admin cancela um torneio que ainda nao comecou; todos recebem o Venox de volta. */
export async function cancelTournament(id: string) {
  await prisma.$transaction(async (tx) => {
    const tournament = await lockTournament(tx, id);
    if (tournament.status !== 'OPEN') throw new AppError('Só é possível cancelar antes do início', 409);
    await cancelOpen(tx, tournament);
  });
  await notifyEntrants(id);
}

/** Paga o podio: campeao, vice e os perdedores das semifinais. */
async function finishTournament(tx: Tx, tournament: Tournament, final: TournamentMatch, championId: string): Promise<void> {
  const loserOf = (match: Pick<TournamentMatch, 'player0Id' | 'player1Id' | 'winnerId'>) =>
    match.player0Id === match.winnerId ? match.player1Id : match.player0Id;
  const semis = await tx.tournamentMatch.findMany({
    where: { tournamentId: tournament.id, round: tournament.rounds! - 1 },
    orderBy: { slot: 'asc' },
  });
  const podium = [championId, loserOf({ ...final, winnerId: championId }), ...semis.map(loserOf)];
  const prizes = prizesFor(tournament.pot);

  for (const [index, userId] of podium.entries()) {
    if (!userId) continue;
    await tx.tournamentEntry.update({
      where: { tournamentId_userId: { tournamentId: tournament.id, userId } },
      data: { placement: Math.min(index + 1, 3), prize: prizes[index] },
    });
    if (prizes[index] > 0) await addVenox(tx, userId, prizes[index], 'TOURNAMENT_PRIZE', tournament.id);
  }
  await tx.tournament.update({ where: { id: tournament.id }, data: { status: 'FINISHED', finishedAt: new Date() } });
  logger.info('Torneio encerrado', { tournamentId: tournament.id, pot: tournament.pot });
}

/** Grava o vencedor de uma partida e o leva para a proxima rodada (ou encerra o torneio na final). */
async function decideMatch(tx: Tx, tournament: Tournament, match: TournamentMatch, winnerId: string): Promise<void> {
  await tx.tournamentMatch.update({ where: { id: match.id }, data: { winnerId } });
  if (match.round === tournament.rounds) {
    await finishTournament(tx, tournament, match, winnerId);
    return;
  }
  await tx.tournamentMatch.update({
    where: { tournamentId_round_slot: { tournamentId: tournament.id, round: match.round + 1, slot: Math.floor(match.slot / 2) } },
    data: match.slot % 2 === 0 ? { player0Id: winnerId } : { player1Id: winnerId },
  });
}

/**
 * Largada: monta a chave com a menor potencia de 2 que cabe os inscritos. Os primeiros inscritos
 * passam direto da 1a rodada (isencao); os demais sao sorteados. Com menos de 4, cancela e devolve.
 */
async function startTournament(tx: Tx, tournament: Tournament): Promise<void> {
  const entries = await tx.tournamentEntry.findMany({ where: { tournamentId: tournament.id }, orderBy: { createdAt: 'asc' } });
  if (entries.length < MIN_PLAYERS) {
    await cancelOpen(tx, tournament);
    logger.info('Torneio cancelado por falta de inscritos', { tournamentId: tournament.id, players: entries.length });
    return;
  }

  const rounds = Math.ceil(Math.log2(entries.length));
  const bracketSize = 2 ** rounds;
  const byes = bracketSize - entries.length;
  const others = shuffle(entries.slice(byes).map((entry) => entry.userId));
  const pairs = shuffle([
    ...entries.slice(0, byes).map((entry) => [entry.userId, null]),
    ...Array.from({ length: others.length / 2 }, (_, i) => [others[2 * i], others[2 * i + 1]]),
  ]);

  await tx.tournamentMatch.createMany({
    data: Array.from({ length: rounds }, (_, r) =>
      Array.from({ length: bracketSize / 2 ** (r + 1) }, (_, slot) => ({
        tournamentId: tournament.id,
        round: r + 1,
        slot,
        ...(r === 0 ? { player0Id: pairs[slot][0], player1Id: pairs[slot][1] } : {}),
      })),
    ).flat(),
  });
  const started = await tx.tournament.update({ where: { id: tournament.id }, data: { status: 'RUNNING', rounds } });

  const byeMatches = await tx.tournamentMatch.findMany({ where: { tournamentId: tournament.id, round: 1, player1Id: null } });
  for (const match of byeMatches) await decideMatch(tx, started, match, match.player0Id!);
}

/**
 * Fim de uma mesa de torneio (na transacao da mesa): o vencedor avanca. Empate (damas, xadrez)
 * libera a partida para uma nova mesa, ate alguem vencer.
 */
export async function recordTournamentResult(
  tx: Tx,
  tableId: string,
  winnerSeats: number[],
  seats: Array<{ seat: number; userId: string }>,
): Promise<void> {
  const match = await tx.tournamentMatch.findUnique({ where: { tableId } });
  if (!match || match.winnerId) return;
  const winner = seats.find((seat) => winnerSeats.includes(seat.seat));
  if (!winner) {
    await tx.tournamentMatch.update({ where: { id: match.id }, data: { tableId: null } });
    return;
  }
  const tournament = await lockTournament(tx, match.tournamentId);
  await decideMatch(tx, tournament, match, winner.userId);
}

/** Abre as mesas das partidas que ja tem os dois jogadores e avisa os inscritos. */
export async function advanceTournament(id: string): Promise<void> {
  const tables = await prisma.$transaction(async (tx) => {
    const tournament = await lockTournament(tx, id);
    if (tournament.status !== 'RUNNING') return [];
    const ready = await tx.tournamentMatch.findMany({
      where: { tournamentId: id, winnerId: null, tableId: null, player0Id: { not: null }, player1Id: { not: null } },
    });
    const created = [];
    for (const match of ready) {
      const table = await startTournamentTable(tx, tournament, [match.player0Id!, match.player1Id!]);
      await tx.tournamentMatch.update({ where: { id: match.id }, data: { tableId: table.id } });
      created.push(table);
    }
    return created;
  });
  await announceTables(tables);
  await notifyEntrants(id);
}

/** A cada ciclo: torneios no horario largam (ou sao cancelados) e os em andamento abrem as mesas prontas. */
export async function tournamentTick(now = new Date()): Promise<void> {
  const due = await prisma.tournament.findMany({ where: { status: 'OPEN', startsAt: { lte: now } }, select: { id: true } });
  for (const { id } of due) {
    await prisma.$transaction(async (tx) => {
      const tournament = await lockTournament(tx, id);
      if (tournament.status === 'OPEN') await startTournament(tx, tournament);
    });
    await notifyEntrants(id);
  }
  const running = await prisma.tournament.findMany({ where: { status: 'RUNNING' }, select: { id: true } });
  for (const { id } of running) await advanceTournament(id);
}

const PUBLIC_USER = { select: { id: true, nickname: true, playerNumber: true } } as const;

const summaryOf = (tournament: Tournament & { _count: { entries: number } }, joined: boolean) => ({
  id: tournament.id,
  name: tournament.name,
  game: tournament.game,
  mode: tournament.mode,
  size: tournament.size,
  entryFee: tournament.entryFee,
  startsAt: tournament.startsAt.toISOString(),
  status: tournament.status,
  players: tournament._count.entries,
  pot: tournament.pot,
  prizes: prizesFor(tournament.pot),
  fullPrizes: prizesFor(tournament.size * tournament.entryFee),
  joined,
});

/** Torneios abertos e em andamento (por horario) e os 10 ultimos encerrados. */
export async function listTournaments(viewerId: string | null) {
  const include = {
    _count: { select: { entries: true } },
    entries: { where: { userId: viewerId ?? undefined }, select: { id: true } },
  };
  const [active, past] = await Promise.all([
    prisma.tournament.findMany({ where: { status: { in: ['OPEN', 'RUNNING'] } }, orderBy: { startsAt: 'asc' }, include }),
    prisma.tournament.findMany({ where: { status: { in: ['FINISHED', 'CANCELLED'] } }, orderBy: { startsAt: 'desc' }, take: 10, include }),
  ]);
  return [...active, ...past].map((tournament) => summaryOf(tournament, viewerId !== null && tournament.entries.length > 0));
}

/** Torneio com inscritos, chave e podio; so apelidos aparecem. */
export async function getTournament(id: string, viewerId: string | null) {
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      _count: { select: { entries: true } },
      entries: { orderBy: { createdAt: 'asc' }, include: { user: PUBLIC_USER } },
      matches: { orderBy: [{ round: 'asc' }, { slot: 'asc' }] },
    },
  });
  if (!tournament) throw new AppError('Torneio não encontrado', 404);

  const users = new Map(tournament.entries.map((entry) => [entry.userId, entry.user]));
  const player = (userId: string | null) => (userId ? { name: displayName(users.get(userId)!), isMe: userId === viewerId } : null);
  const rounds = Array.from({ length: tournament.rounds ?? 0 }, (_, r) =>
    tournament.matches
      .filter((match) => match.round === r + 1)
      .map((match) => ({
        slot: match.slot,
        players: [player(match.player0Id), player(match.player1Id)],
        winner: match.winnerId === null ? null : match.winnerId === match.player0Id ? 0 : 1,
        live: match.tableId !== null && match.winnerId === null,
      })),
  );

  return {
    ...summaryOf(tournament, tournament.entries.some((entry) => entry.userId === viewerId)),
    entrants: tournament.entries.map((entry) => player(entry.userId)!),
    rounds,
    podium: tournament.entries
      .filter((entry) => entry.placement !== null)
      .sort((a, b) => b.prize - a.prize)
      .map((entry) => ({ ...player(entry.userId)!, placement: entry.placement!, prize: entry.prize })),
  };
}
