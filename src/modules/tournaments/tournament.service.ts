import { randomInt } from 'crypto';
import { Prisma, Tournament, TournamentEntry, TournamentMatch } from '@prisma/client';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/errors';
import { emitToUser } from '../../websocket/socket';
import { displayName } from '../profile/nickname';
import { announceTables, leaveQueue, startTournamentTable } from '../tables/tables.service';
import { GameName } from '../tables/tables.types';
import { addVenox } from '../venox/venox.service';
import { ensureScheduledTournaments } from './tournament.schedule';

type Tx = Prisma.TransactionClient;

/** Parte do pote que sai de circulacao (segura a inflacao do Venox). */
export const HOUSE_CUT = 0.1;
/** Divisao do restante: campeao, vice e os dois semifinalistas. */
export const PRIZE_SHARES = [0.5, 0.25, 0.125, 0.125];
/** Equipes minimas (jogadores no mano a mano, duplas na dupla); abaixo disso cancela e devolve. */
export const MIN_TEAMS = 4;
export const TOURNAMENT_SIZES = [8, 16, 32] as const;

/** Formatos aceitos por jogo: [modo, formato]. O primeiro e o padrao. */
export const TOURNAMENT_FORMATS: Record<GameName, Array<[string, string]>> = {
  DOMINO: [
    ['SIX_TILES', 'DUEL'],
    ['SIX_TILES', 'PAIRS'],
    ['BURRINHO', 'PAIRS'],
  ],
  TRUCO: [
    ['PAULISTA', 'DUEL'],
    ['PAULISTA', 'PAIRS'],
  ],
  DAMAS: [['BRASILEIRA', 'DUEL']],
  XADREZ: [['CLASSICO', 'DUEL']],
  LUDO: [
    ['CLASSICO', 'DUEL'],
    ['ARENA', 'DUEL'],
  ],
};

const isPairs = (tournament: Pick<Tournament, 'teamMode'>) => tournament.teamMode === 'PAIRS';
/** Na dupla, a inscricao e da equipe: cada jogador paga metade. */
const feeOf = (tournament: Tournament) => (isPairs(tournament) ? tournament.entryFee / 2 : tournament.entryFee);
/** Vagas em jogadores: o tamanho conta equipes. */
const capacityOf = (tournament: Tournament) => (isPairs(tournament) ? tournament.size * 2 : tournament.size);

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

/** Devolve a inscricao de quem pagou (convidado que nao aceitou nao pagou nada). */
const refund = (tx: Tx, tournament: Tournament, entry: TournamentEntry) =>
  entry.status === 'CONFIRMED' && feeOf(tournament) > 0
    ? addVenox(tx, entry.userId, feeOf(tournament), 'TOURNAMENT_REFUND', entry.id)
    : null;

/** Avisa os inscritos e convidados que o torneio mudou (inscricoes, chave, resultado). */
async function notifyEntrants(tournamentId: string, extraUserIds: string[] = []): Promise<void> {
  const entries = await prisma.tournamentEntry.findMany({ where: { tournamentId }, select: { userId: true } });
  new Set([...entries.map((entry) => entry.userId), ...extraUserIds]).forEach((userId) =>
    emitToUser(userId, 'tournament:changed', { id: tournamentId }),
  );
}

export interface TournamentInput {
  name: string;
  game: GameName;
  mode: string;
  teamMode: string;
  size: (typeof TOURNAMENT_SIZES)[number];
  entryFee: number;
  startsAt: Date;
}

export function createTournament(input: TournamentInput) {
  return prisma.tournament.create({ data: input });
}

/** Cobra a parte do jogador na inscricao. */
async function charge(tx: Tx, tournament: Tournament, entry: TournamentEntry): Promise<void> {
  const fee = feeOf(tournament);
  const [{ venox }] = await tx.$queryRaw<Array<{ venox: number }>>`SELECT venox FROM users WHERE id = ${entry.userId}::uuid FOR UPDATE`;
  if (venox < fee) throw new AppError('Venox insuficiente para a inscrição', 400);
  if (fee > 0) await addVenox(tx, entry.userId, -fee, 'TOURNAMENT_ENTRY', entry.id);
  await tx.tournament.update({ where: { id: tournament.id }, data: { pot: { increment: fee } } });
}

/**
 * Inscricao paga em Venox, ate a largada e enquanto houver vaga. Na dupla, pode convidar um
 * parceiro pelo apelido (ele aceita inscrevendo-se tambem) ou entrar sozinho e ter a dupla sorteada.
 */
export async function joinTournament(userId: string, id: string, partnerNickname?: string) {
  let partnerId: string | null = null;
  await prisma.$transaction(async (tx) => {
    const tournament = await lockTournament(tx, id);
    if (tournament.status !== 'OPEN' || tournament.startsAt <= new Date()) {
      throw new AppError('As inscrições deste torneio estão encerradas', 409);
    }
    const entries = await tx.tournamentEntry.findMany({ where: { tournamentId: id } });
    const mine = entries.find((entry) => entry.userId === userId);

    // Convidado aceitando o convite: paga a sua metade
    if (mine?.status === 'INVITED') {
      await charge(tx, tournament, mine);
      await tx.tournamentEntry.update({ where: { id: mine.id }, data: { status: 'CONFIRMED' } });
      partnerId = mine.partnerId;
      return;
    }
    if (mine) throw new AppError('Você já está inscrito', 409);

    if (partnerNickname !== undefined) {
      if (!isPairs(tournament)) throw new AppError('Este torneio não é em dupla', 400);
      const partner = await tx.user.findFirst({ where: { nickname: { equals: partnerNickname, mode: 'insensitive' } } });
      if (!partner) throw new AppError('Nenhum jogador com esse apelido', 404);
      if (partner.id === userId) throw new AppError('Convide outro jogador', 400);
      if (entries.some((entry) => entry.userId === partner.id)) throw new AppError('Esse jogador já está no torneio', 409);
      partnerId = partner.id;
    }
    if (entries.length + (partnerId ? 2 : 1) > capacityOf(tournament)) throw new AppError('Torneio lotado', 409);

    const entry = await tx.tournamentEntry.create({ data: { tournamentId: id, userId, partnerId } });
    await charge(tx, tournament, entry);
    if (partnerId) {
      await tx.tournamentEntry.create({ data: { tournamentId: id, userId: partnerId, partnerId: userId, status: 'INVITED' } });
    }
  });
  await notifyEntrants(id);
  return getTournament(id, userId);
}

/**
 * Desiste antes da largada (ou recusa o convite), com o Venox de volta. O parceiro confirmado
 * continua inscrito e passa a esperar o sorteio; o convite ainda nao aceito e desfeito.
 */
export async function leaveTournament(userId: string, id: string) {
  await prisma.$transaction(async (tx) => {
    const tournament = await lockTournament(tx, id);
    if (tournament.status !== 'OPEN') throw new AppError('O torneio já começou', 409);
    const entry = await tx.tournamentEntry.findUnique({ where: { tournamentId_userId: { tournamentId: id, userId } } });
    if (!entry) throw new AppError('Você não está inscrito', 409);

    await tx.tournamentEntry.delete({ where: { id: entry.id } });
    if (entry.status === 'CONFIRMED') {
      await refund(tx, tournament, entry);
      await tx.tournament.update({ where: { id }, data: { pot: { decrement: feeOf(tournament) } } });
    }
    if (entry.partnerId) {
      const partner = await tx.tournamentEntry.findUnique({ where: { tournamentId_userId: { tournamentId: id, userId: entry.partnerId } } });
      if (partner?.status === 'INVITED') await tx.tournamentEntry.delete({ where: { id: partner.id } });
      else if (partner) await tx.tournamentEntry.update({ where: { id: partner.id }, data: { partnerId: null } });
    }
  });
  await notifyEntrants(id, [userId]);
  return getTournament(id, userId);
}

async function cancelOpen(tx: Tx, tournament: Tournament): Promise<void> {
  const entries = await tx.tournamentEntry.findMany({ where: { tournamentId: tournament.id } });
  for (const entry of entries) await refund(tx, tournament, entry);
  await tx.tournamentEntry.deleteMany({ where: { tournamentId: tournament.id, status: 'INVITED' } });
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

/** Jogadores de cada equipe (pelo capitao), na ordem em que se inscreveram. */
async function teamsOf(tx: Tx, tournamentId: string): Promise<Map<string, string[]>> {
  const entries = await tx.tournamentEntry.findMany({ where: { tournamentId, captainId: { not: null } }, orderBy: { createdAt: 'asc' } });
  const teams = new Map<string, string[]>();
  entries.forEach((entry) => teams.set(entry.captainId!, [...(teams.get(entry.captainId!) ?? []), entry.userId]));
  return teams;
}

/** Paga o podio: campeao, vice e os perdedores das semifinais. Na dupla, o premio e dividido entre os dois. */
async function finishTournament(tx: Tx, tournament: Tournament, final: TournamentMatch, championId: string): Promise<void> {
  const loserOf = (match: Pick<TournamentMatch, 'player0Id' | 'player1Id' | 'winnerId'>) =>
    match.player0Id === match.winnerId ? match.player1Id : match.player0Id;
  const semis = await tx.tournamentMatch.findMany({
    where: { tournamentId: tournament.id, round: tournament.rounds! - 1 },
    orderBy: { slot: 'asc' },
  });
  const podium = [championId, loserOf({ ...final, winnerId: championId }), ...semis.map(loserOf)];
  const prizes = prizesFor(tournament.pot);
  const teams = await teamsOf(tx, tournament.id);

  for (const [index, captainId] of podium.entries()) {
    if (!captainId) continue;
    const members = teams.get(captainId)!;
    for (const [m, userId] of members.entries()) {
      // Sobra da divisao fica com o capitao
      const prize = Math.floor(prizes[index] / members.length) + (m === 0 ? prizes[index] % members.length : 0);
      await tx.tournamentEntry.update({
        where: { tournamentId_userId: { tournamentId: tournament.id, userId } },
        data: { placement: Math.min(index + 1, 3), prize },
      });
      if (prize > 0) await addVenox(tx, userId, prize, 'TOURNAMENT_PRIZE', tournament.id);
    }
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
 * Forma as equipes na largada. Mano a mano: cada inscrito e uma. Dupla: primeiro as duplas
 * combinadas, depois as sorteadas entre quem entrou sozinho (quem sobrar recebe o Venox de volta).
 * Devolve os capitaes na ordem de inscricao (as isencoes vao para as primeiras equipes).
 */
async function formTeams(tx: Tx, tournament: Tournament): Promise<string[][]> {
  const entries = await tx.tournamentEntry.findMany({ where: { tournamentId: tournament.id }, orderBy: { createdAt: 'asc' } });
  await tx.tournamentEntry.deleteMany({ where: { tournamentId: tournament.id, status: 'INVITED' } });
  const confirmed = entries.filter((entry) => entry.status === 'CONFIRMED');
  if (!isPairs(tournament)) return confirmed.map((entry) => [entry.userId]);

  const byUser = new Map(confirmed.map((entry) => [entry.userId, entry]));
  const paired = new Set<string>();
  const teams: string[][] = [];
  for (const entry of confirmed) {
    const partner = entry.partnerId ? byUser.get(entry.partnerId) : undefined;
    if (paired.has(entry.userId) || partner?.partnerId !== entry.userId) continue;
    teams.push([entry.userId, partner.userId]);
    paired.add(entry.userId).add(partner.userId);
  }
  const solo = shuffle(confirmed.filter((entry) => !paired.has(entry.userId)));
  for (let i = 0; i + 1 < solo.length; i += 2) teams.push([solo[i].userId, solo[i + 1].userId]);
  if (solo.length % 2 === 1) {
    const left = solo[solo.length - 1];
    await refund(tx, tournament, left);
    await tx.tournamentEntry.delete({ where: { id: left.id } });
    await tx.tournament.update({ where: { id: tournament.id }, data: { pot: { decrement: feeOf(tournament) } } });
  }
  return teams;
}

/**
 * Largada: monta a chave com a menor potencia de 2 que cabe as equipes. As primeiras passam
 * direto da 1a rodada (isencao); as demais sao sorteadas. Com menos de 4 equipes, cancela e devolve.
 */
async function startTournament(tx: Tx, tournament: Tournament): Promise<void> {
  const teams = await formTeams(tx, tournament);
  const current = await tx.tournament.findUniqueOrThrow({ where: { id: tournament.id } });
  if (teams.length < MIN_TEAMS) {
    await cancelOpen(tx, current);
    logger.info('Torneio cancelado por falta de inscritos', { tournamentId: tournament.id, teams: teams.length });
    return;
  }
  for (const team of teams) {
    await tx.tournamentEntry.updateMany({ where: { tournamentId: tournament.id, userId: { in: team } }, data: { captainId: team[0] } });
  }

  const captains = teams.map((team) => team[0]);
  const rounds = Math.ceil(Math.log2(captains.length));
  const bracketSize = 2 ** rounds;
  const byes = bracketSize - captains.length;
  const others = shuffle(captains.slice(byes));
  const pairs = shuffle([
    ...captains.slice(0, byes).map((captain) => [captain, null]),
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
 * Fim de uma mesa de torneio (na transacao da mesa): a equipe vencedora avanca. Empate (damas,
 * xadrez, domino trancado empatado) libera a partida para uma nova mesa, ate alguem vencer.
 */
export async function recordTournamentResult(
  tx: Tx,
  tableId: string,
  winnerSeats: number[],
  seats: Array<{ seat: number; userId: string }>,
): Promise<void> {
  const match = await tx.tournamentMatch.findUnique({ where: { tableId } });
  if (!match || match.winnerId) return;
  const tournament = await lockTournament(tx, match.tournamentId);
  const teams = await teamsOf(tx, tournament.id);
  const captainOf = (userId: string) => [...teams].find(([, members]) => members.includes(userId))![0];
  const winners = new Set(seats.filter((seat) => winnerSeats.includes(seat.seat)).map((seat) => captainOf(seat.userId)));

  if (winners.size !== 1) {
    await tx.tournamentMatch.update({ where: { id: match.id }, data: { tableId: null } });
    return;
  }
  await decideMatch(tx, tournament, match, [...winners][0]);
}

/**
 * Torneio em andamento em que o jogador ainda esta vivo (sua equipe nao perdeu), e se a partida
 * dele esta com mesa aberta agora. Quem esta vivo nao entra em mesas comuns.
 */
export async function activeTournamentOf(db: Tx | typeof prisma, userId: string) {
  const [row] = await db.$queryRaw<Array<{ id: string; name: string; game: string; live: boolean }>>`
    SELECT t.id, t.name, t.game,
      EXISTS (
        SELECT 1 FROM tournament_matches m
        WHERE m.tournament_id = t.id AND m.table_id IS NOT NULL AND m.winner_id IS NULL
          AND e.captain_id IN (m.player0_id, m.player1_id)
      ) AS live
    FROM tournament_entries e JOIN tournaments t ON t.id = e.tournament_id
    WHERE e.user_id = ${userId}::uuid AND t.status = 'RUNNING' AND e.captain_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM tournament_matches m
        WHERE m.tournament_id = t.id AND m.winner_id IS NOT NULL AND m.winner_id <> e.captain_id
          AND e.captain_id IN (m.player0_id, m.player1_id)
      )
    ORDER BY live DESC, t.starts_at
    LIMIT 1
  `;
  return row ?? null;
}

/** Quem vai jogar pela chave e esta so aguardando numa fila comum sai dela (com as chaves de volta). */
async function leaveRegularQueues(tournamentId: string): Promise<void> {
  const ready = await prisma.tournamentMatch.findMany({
    where: { tournamentId, winnerId: null, tableId: null, player0Id: { not: null }, player1Id: { not: null } },
    select: { player0Id: true, player1Id: true },
  });
  if (ready.length === 0) return;
  const captains = ready.flatMap((match) => [match.player0Id!, match.player1Id!]);
  const members = await prisma.tournamentEntry.findMany({ where: { tournamentId, captainId: { in: captains } }, select: { userId: true } });
  const waiting = await prisma.gameSeat.findMany({
    where: { userId: { in: members.map((member) => member.userId) }, table: { status: 'WAITING', tournamentId: null } },
    select: { userId: true },
  });
  for (const { userId } of waiting) {
    await leaveQueue(userId).catch((err) => logger.warn('Não saiu da fila comum para o torneio', { err, userId }));
  }
}

/** Abre as mesas das partidas que ja tem as duas equipes e avisa os inscritos. */
export async function advanceTournament(id: string): Promise<void> {
  await leaveRegularQueues(id);
  const tables = await prisma.$transaction(async (tx) => {
    const tournament = await lockTournament(tx, id);
    if (tournament.status !== 'RUNNING') return [];
    const ready = await tx.tournamentMatch.findMany({
      where: { tournamentId: id, winnerId: null, tableId: null, player0Id: { not: null }, player1Id: { not: null } },
    });
    const teams = await teamsOf(tx, id);
    const created = [];
    for (const match of ready) {
      const [a, b] = [teams.get(match.player0Id!)!, teams.get(match.player1Id!)!];
      // Dupla: parceiros sentam frente a frente (lugares 0 e 2 contra 1 e 3)
      const userIds = a.flatMap((userId, i) => [userId, b[i]]);
      const table = await startTournamentTable(tx, tournament, userIds);
      await tx.tournamentMatch.update({ where: { id: match.id }, data: { tableId: table.id } });
      created.push(table);
    }
    return created;
  });
  await announceTables(tables);
  await notifyEntrants(id);
}

/**
 * A cada ciclo: torneios no horario largam (ou sao cancelados), os em andamento abrem as mesas
 * prontas e as agendas automaticas abrem o proximo torneio.
 */
export async function tournamentTick(now = new Date()): Promise<void> {
  const due = await prisma.tournament.findMany({ where: { status: 'OPEN', startsAt: { lte: now } }, select: { id: true } });
  for (const { id } of due) {
    const invited = await prisma.tournamentEntry.findMany({ where: { tournamentId: id }, select: { userId: true } });
    await prisma.$transaction(async (tx) => {
      const tournament = await lockTournament(tx, id);
      if (tournament.status === 'OPEN') await startTournament(tx, tournament);
    });
    await notifyEntrants(id, invited.map((entry) => entry.userId));
  }
  const running = await prisma.tournament.findMany({ where: { status: 'RUNNING' }, select: { id: true } });
  for (const { id } of running) await advanceTournament(id);
  await ensureScheduledTournaments(now);
}

const PUBLIC_USER = { select: { id: true, nickname: true, playerNumber: true } } as const;

const summaryOf = (
  tournament: Tournament & { entries: Array<Pick<TournamentEntry, 'userId' | 'status'>> },
  viewerId: string | null,
) => {
  const mine = tournament.entries.find((entry) => entry.userId === viewerId);
  return {
    id: tournament.id,
    name: tournament.name,
    game: tournament.game,
    mode: tournament.mode,
    teamMode: tournament.teamMode,
    size: tournament.size,
    entryFee: tournament.entryFee,
    feePerPlayer: feeOf(tournament),
    startsAt: tournament.startsAt.toISOString(),
    status: tournament.status,
    players: tournament.entries.filter((entry) => entry.status === 'CONFIRMED').length,
    capacity: capacityOf(tournament),
    pot: tournament.pot,
    prizes: prizesFor(tournament.pot),
    fullPrizes: prizesFor(tournament.size * tournament.entryFee),
    joined: mine?.status === 'CONFIRMED',
    invited: mine?.status === 'INVITED',
  };
};

/** Torneios abertos e em andamento (por horario) e os 10 ultimos encerrados. */
export async function listTournaments(viewerId: string | null) {
  const include = { entries: { select: { userId: true, status: true } } };
  const [active, past] = await Promise.all([
    prisma.tournament.findMany({ where: { status: { in: ['OPEN', 'RUNNING'] } }, orderBy: { startsAt: 'asc' }, include }),
    prisma.tournament.findMany({ where: { status: { in: ['FINISHED', 'CANCELLED'] } }, orderBy: { startsAt: 'desc' }, take: 10, include }),
  ]);
  return [...active, ...past].map((tournament) => summaryOf(tournament, viewerId));
}

/** Torneio com inscritos, chave e podio; so apelidos aparecem (na dupla, "A & B"). */
export async function getTournament(id: string, viewerId: string | null) {
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      entries: { orderBy: { createdAt: 'asc' }, include: { user: PUBLIC_USER } },
      matches: { orderBy: [{ round: 'asc' }, { slot: 'asc' }] },
    },
  });
  if (!tournament) throw new AppError('Torneio não encontrado', 404);

  const nameOf = new Map(tournament.entries.map((entry) => [entry.userId, displayName(entry.user)]));
  const team = (captainId: string | null) => {
    if (!captainId) return null;
    const members = tournament.entries.filter((entry) => entry.captainId === captainId).map((entry) => entry.userId);
    return { name: members.map((userId) => nameOf.get(userId)).join(' & '), isMe: viewerId !== null && members.includes(viewerId) };
  };
  const rounds = Array.from({ length: tournament.rounds ?? 0 }, (_, r) =>
    tournament.matches
      .filter((match) => match.round === r + 1)
      .map((match) => ({
        slot: match.slot,
        players: [team(match.player0Id), team(match.player1Id)],
        winner: match.winnerId === null ? null : match.winnerId === match.player0Id ? 0 : 1,
        live: match.tableId !== null && match.winnerId === null,
      })),
  );

  // Inscritos antes da largada: duplas fechadas uma vez, convites pendentes e quem espera sorteio
  const confirmed = tournament.entries.filter((entry) => entry.status === 'CONFIRMED');
  const listed = new Set<string>();
  const entrants = confirmed.flatMap((entry) => {
    if (listed.has(entry.userId)) return [];
    const partner = tournament.entries.find((other) => other.userId === entry.partnerId);
    const isMe = entry.userId === viewerId || partner?.userId === viewerId;
    let name = nameOf.get(entry.userId)!;
    if (partner?.status === 'CONFIRMED') {
      listed.add(partner.userId);
      name += ` & ${nameOf.get(partner.userId)}`;
    } else if (partner) name += ` (aguardando ${nameOf.get(partner.userId)})`;
    else if (isPairs(tournament)) name += ' (dupla por sorteio)';
    return [{ name, isMe }];
  });
  const mine = tournament.entries.find((entry) => entry.userId === viewerId);

  return {
    ...summaryOf(tournament, viewerId),
    invitedBy: mine?.status === 'INVITED' && mine.partnerId ? nameOf.get(mine.partnerId)! : null,
    entrants,
    rounds,
    podium: [...new Map(tournament.entries.filter((entry) => entry.placement !== null).map((entry) => [entry.captainId, entry])).values()]
      .sort((a, b) => a.placement! - b.placement!)
      .map((entry) => ({
        ...team(entry.captainId)!,
        placement: entry.placement!,
        prize: tournament.entries.filter((other) => other.captainId === entry.captainId).reduce((sum, other) => sum + other.prize, 0),
      })),
  };
}
