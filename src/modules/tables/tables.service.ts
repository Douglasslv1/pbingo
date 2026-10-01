import { GameSeat, GameTable, Prisma } from '@prisma/client';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/errors';
import { HistoryPage } from '../../utils/pagination';
import { emitToUser } from '../../websocket/socket';
import { dominoAdapter } from '../domino/domino.adapter';
import { splitPrizeInCents } from '../rounds/round.settlement';
import { trucoAdapter } from '../truco/truco.adapter';
import { GameAdapter, GameName, GameRuleError, QueueChoice } from './tables.types';
import { registerTurnTimeoutHandler, scheduleTurnTimeout } from './turn.scheduler';

type Tx = Prisma.TransactionClient;
type TableWithSeats = GameTable & { seats: Array<GameSeat & { user: { name: string } }> };

const ADAPTERS: Record<GameName, GameAdapter> = {
  DOMINO: dominoAdapter as GameAdapter,
  TRUCO: trucoAdapter as GameAdapter,
};
const adapterOf = (table: Pick<GameTable, 'game'>): GameAdapter => ADAPTERS[table.game as GameName];

const ACTIVE_STATUSES = ['WAITING', 'PLAYING'] as const;

const queueTimeoutMs = () => env.queueTimeoutMinutes * 60 * 1000;

/** Jogador ausente: o sistema joga por ele depois desse intervalo curto. */
export const AWAY_TURN_MS = 3000;

/** Prazo da proxima acao: o tempo normal, ou o intervalo curto se quem deve agir esta ausente. */
function nextDeadline(adapter: GameAdapter, state: unknown, seats: GameSeat[], now = new Date()): Date | null {
  if (adapter.isFinished(state)) return null;
  const acting = adapter.actingSeat(state);
  const away = seats.find((seat) => seat.seat === acting)?.isAway ?? false;
  return new Date(now.getTime() + (away ? AWAY_TURN_MS : adapter.turnSeconds() * 1000));
}

/** Serializa entradas e saidas da mesma fila, para duas pessoas nao abrirem mesas separadas ao mesmo tempo. */
async function lockQueue(tx: Tx, table: Pick<GameTable, 'game' | 'mode' | 'teamMode' | 'stake'>): Promise<void> {
  const key = `${table.game}:${table.mode}:${table.teamMode}:${table.stake}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}

async function lockTable(tx: Tx, tableId: string): Promise<GameTable | null> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM game_tables WHERE id = ${tableId}::uuid FOR UPDATE`;
  return rows.length > 0 ? tx.gameTable.findUnique({ where: { id: tableId } }) : null;
}

/** Devolve as chaves das cadeiras pagas e registra no extrato. */
async function refundSeats(tx: Tx, table: GameTable, seats: GameSeat[]): Promise<void> {
  const paid = seats.filter((seat) => seat.creditsSpent > 0);
  const userIds = [...new Set(paid.map((seat) => seat.userId))].sort();
  if (userIds.length === 0) return;

  await tx.$queryRaw`SELECT user_id FROM user_credits WHERE user_id = ANY(${userIds}::uuid[]) ORDER BY user_id FOR UPDATE`;
  for (const seat of paid) {
    await tx.userCredit.update({ where: { userId: seat.userId }, data: { balance: { increment: seat.creditsSpent } } });
    await tx.transaction.create({
      data: { userId: seat.userId, type: 'KEY_REFUND', amountCredits: seat.creditsSpent, status: 'COMPLETED', game: table.game },
    });
  }
}

/** Divide o pote entre os lugares vencedores e credita o saldo de premios de cada um. */
async function payWinners(tx: Tx, table: GameTable, winnerSeats: number[], seats: GameSeat[]): Promise<void> {
  if (table.prizePool.isZero()) return;
  const winners = seats.filter((seat) => winnerSeats.includes(seat.seat)).sort((a, b) => a.seat - b.seat);
  const shares = splitPrizeInCents(Math.round(Number(table.prizePool) * 100), winners.length);

  const userIds = [...new Set(winners.map((seat) => seat.userId))].sort();
  await tx.$queryRaw`SELECT user_id FROM user_prizes WHERE user_id = ANY(${userIds}::uuid[]) ORDER BY user_id FOR UPDATE`;

  for (const [index, seat] of winners.entries()) {
    const prize = shares[index] / 100;
    await tx.gameSeat.update({ where: { id: seat.id }, data: { prizeAmount: prize } });
    await tx.userPrize.update({ where: { userId: seat.userId }, data: { balanceFiat: { increment: prize } } });
    await tx.transaction.create({
      data: { userId: seat.userId, type: 'PRIZE_PAYOUT', amountFiat: prize, status: 'COMPLETED', game: table.game },
    });
  }
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** Visao da mesa para um jogador: o motor do jogo decide o que ele pode ver. */
export function tableViewFor(table: TableWithSeats, userId: string) {
  const mySeat = table.seats.find((seat) => seat.userId === userId)?.seat ?? null;

  return {
    id: table.id,
    kind: table.game,
    mode: table.mode,
    teamMode: table.teamMode,
    stake: table.stake,
    status: table.status,
    prizePool: table.prizePool.toString(),
    queueExpiresAt:
      table.status === 'WAITING' ? new Date(table.createdAt.getTime() + queueTimeoutMs()).toISOString() : null,
    mySeat,
    players: [...table.seats]
      .sort((a, b) => a.seat - b.seat)
      .map((seat) => ({
        seat: seat.seat,
        name: firstName(seat.user.name),
        isMe: seat.userId === userId,
        away: seat.isAway,
        prizeAmount: seat.prizeAmount?.toString() ?? null,
      })),
    turnDeadline: table.status === 'PLAYING' ? (table.turnDeadline?.toISOString() ?? null) : null,
    game: table.state && mySeat !== null ? adapterOf(table).viewFor(table.state, mySeat) : null,
  };
}

async function loadTable(tableId: string): Promise<TableWithSeats | null> {
  return prisma.gameTable.findUnique({
    where: { id: tableId },
    include: { seats: { include: { user: { select: { name: true } } } } },
  });
}

/** Envia a cada jogador da mesa (e a quem acabou de sair) a visao atualizada. */
async function publishTable(tableId: string, extraUserIds: string[] = []): Promise<void> {
  const table = await loadTable(tableId);
  if (!table) return;
  const prefix = table.game.toLowerCase();
  for (const seat of table.seats) {
    emitToUser(seat.userId, `${prefix}:table`, tableViewFor(table, seat.userId));
  }
  for (const userId of extraUserIds) {
    emitToUser(userId, `${prefix}:left`, { tableId, status: table.status });
  }
}

const toCents = (value: number) => Math.round(value * 100) / 100;

/**
 * Entra na fila escolhida pagando o valor da mesa (1, 2 ou 5 chaves; nada no modo gratuito).
 * Com a mesa cheia, a partida comeca. Cada jogador fica em uma mesa por vez, de qualquer jogo.
 */
export async function joinQueue(game: GameName, userId: string, choice: QueueChoice) {
  const adapter = ADAPTERS[game];
  if (!adapter.enabled()) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (user?.role !== 'ADMIN') {
      throw new AppError(`O ${adapter.label} ainda não está disponível`, 403);
    }
  }

  const free = adapter.free();
  // No modo gratuito todos caem na mesma fila, sem valor
  const queue = { game, mode: choice.mode, teamMode: choice.teamMode, stake: free ? 1 : choice.stake };
  const price = free ? 0 : queue.stake * env.ticketPriceCredits;
  const contribution = free ? 0 : toCents(queue.stake * env.prizeContributionPerTicket);

  const started = await prisma.$transaction(async (tx) => {
    // Travar a carteira primeiro serializa pedidos simultaneos do mesmo jogador
    const credits = await tx.$queryRaw<Array<{ balance: number }>>`
      SELECT balance FROM user_credits WHERE user_id = ${userId}::uuid FOR UPDATE
    `;

    const active = await tx.gameSeat.findFirst({
      where: { userId, table: { status: { in: [...ACTIVE_STATUSES] } } },
      include: { table: { select: { game: true } } },
    });
    if (active) {
      throw new AppError(`Você já está em uma mesa de ${adapterOf(active.table).label}`, 409);
    }
    if ((credits[0]?.balance ?? 0) < price) {
      throw new AppError('Saldo de chaves insuficiente para entrar na mesa', 400);
    }

    await lockQueue(tx, queue);
    const table =
      (await tx.gameTable.findFirst({
        where: { status: 'WAITING', ...queue },
        orderBy: { createdAt: 'asc' },
        include: { seats: true },
      })) ?? (await tx.gameTable.create({ data: queue, include: { seats: true } }));

    const seatCount = adapter.seatsFor(choice.teamMode);
    const taken = new Set(table.seats.map((seat) => seat.seat));
    const seat = Array.from({ length: seatCount }, (_, index) => index).find((candidate) => !taken.has(candidate));
    if (seat === undefined) {
      throw new AppError('Mesa cheia, tente novamente', 409);
    }

    if (price > 0) {
      await tx.userCredit.update({ where: { userId }, data: { balance: { decrement: price } } });
      await tx.transaction.create({
        data: { userId, type: 'SPEND_KEY', amountCredits: price, status: 'COMPLETED', game },
      });
    }
    await tx.gameSeat.create({
      data: { tableId: table.id, userId, seat, creditsSpent: price, prizeContribution: contribution },
    });

    const dealt = table.seats.length + 1 === seatCount ? adapter.deal(choice.mode, choice.teamMode) : null;
    const updated = await tx.gameTable.update({
      where: { id: table.id },
      data: {
        prizePool: { increment: contribution },
        ...(dealt
          ? {
              status: 'PLAYING',
              startedAt: new Date(),
              state: dealt as Prisma.InputJsonValue,
              turnDeadline: nextDeadline(adapter, dealt, []),
            }
          : {}),
      },
    });

    return { id: table.id, deadline: updated.turnDeadline };
  });

  scheduleTurnTimeout(started.id, started.deadline);
  await publishTable(started.id);
  const table = await loadTable(started.id);
  return table ? tableViewFor(table, userId) : null;
}

/** Sai da fila antes da partida comecar, recuperando as chaves. */
export async function leaveQueue(userId: string) {
  const left = await prisma.$transaction(async (tx) => {
    const seat = await tx.gameSeat.findFirst({
      where: { userId, table: { status: 'WAITING' } },
      include: { table: true },
    });
    if (!seat) {
      throw new AppError('Você não está aguardando em nenhuma mesa', 409);
    }

    await lockQueue(tx, seat.table);
    const table = await lockTable(tx, seat.tableId);
    if (!table || table.status !== 'WAITING') {
      throw new AppError('A partida já começou - não é mais possível sair', 409);
    }

    await refundSeats(tx, table, [seat]);
    await tx.gameSeat.delete({ where: { id: seat.id } });
    const remaining = await tx.gameSeat.count({ where: { tableId: table.id } });
    await tx.gameTable.update({
      where: { id: table.id },
      data: {
        prizePool: { decrement: seat.prizeContribution },
        ...(remaining === 0 ? { status: 'CANCELLED', finishedAt: new Date() } : {}),
      },
    });
    return { tableId: table.id, refundedCredits: seat.creditsSpent };
  });

  await publishTable(left.tableId, [userId]);
  return left;
}

interface Advance {
  seat: number;
  action: unknown;
  automatic: boolean;
}

/**
 * Aplica uma acao (do jogador ou automatica) e, em seguida, as acoes forcadas (passar/comprar
 * sem opcao), gravando cada uma. Define o prazo da proxima acao e, se a partida terminar,
 * paga os vencedores - tudo na transacao da mesa bloqueada.
 */
async function advanceTable(tx: Tx, table: GameTable, seats: GameSeat[], first: Advance): Promise<Date | null> {
  const adapter = adapterOf(table);
  let state = table.state as unknown;
  const moves: Array<Advance & { moveNumber: number }> = [];

  try {
    state = adapter.apply(state, first.seat, first.action);
    moves.push({ ...first, moveNumber: adapter.moveCount(state) });

    while (!adapter.isFinished(state) && adapter.isForced(state)) {
      const seat = adapter.actingSeat(state);
      const forced = adapter.autoAction(state, seat);
      state = adapter.apply(state, seat, forced);
      moves.push({ seat, action: forced, automatic: true, moveNumber: adapter.moveCount(state) });
    }
  } catch (err) {
    if (err instanceof GameRuleError) {
      throw new AppError(err.message, 422);
    }
    throw err;
  }

  await tx.gameMove.createMany({
    data: moves.map((move) => ({
      tableId: table.id,
      seat: move.seat,
      moveNumber: move.moveNumber,
      action: move.action as Prisma.InputJsonValue,
      automatic: move.automatic,
    })),
  });

  const finished = adapter.isFinished(state);
  const deadline = nextDeadline(adapter, state, seats);
  await tx.gameTable.update({
    where: { id: table.id },
    data: {
      state: state as Prisma.InputJsonValue,
      turnDeadline: deadline,
      ...(finished ? { status: 'FINISHED', finishedAt: new Date() } : {}),
    },
  });
  if (finished) {
    await payWinners(tx, table, adapter.winnerSeats(state), seats);
  }
  return deadline;
}

async function lockGameTable(tx: Tx, game: GameName, tableId: string) {
  const table = await lockTable(tx, tableId);
  if (!table || table.game !== game) {
    throw new AppError('Mesa não encontrada', 404);
  }
  const seats = await tx.gameSeat.findMany({ where: { tableId } });
  return { table, seats };
}

/** Acao do jogador. Agir tambem tira a marca de ausente e zera os tempos esgotados. */
export async function playMove(game: GameName, userId: string, tableId: string, action: unknown) {
  const deadline = await prisma.$transaction(async (tx) => {
    const { table, seats } = await lockGameTable(tx, game, tableId);
    const mySeat = seats.find((seat) => seat.userId === userId);
    if (!mySeat) {
      throw new AppError('Você não está nesta mesa', 403);
    }
    if (table.status !== 'PLAYING' || !table.state) {
      throw new AppError('A partida não está em andamento', 409);
    }

    if (mySeat.timeouts > 0 || mySeat.isAway) {
      await tx.gameSeat.update({ where: { id: mySeat.id }, data: { timeouts: 0, isAway: false } });
      mySeat.timeouts = 0;
      mySeat.isAway = false;
    }
    return advanceTable(tx, table, seats, { seat: mySeat.seat, action, automatic: false });
  });

  scheduleTurnTimeout(tableId, deadline);
  await publishTable(tableId);
  const table = await loadTable(tableId);
  return table ? tableViewFor(table, userId) : null;
}

/**
 * Prazo vencido: o sistema age por quem devia agir. Dois tempos esgotados seguidos marcam o
 * jogador como ausente (o sistema passa a agir por ele a cada poucos segundos).
 * Retorna o prazo seguinte para o cronometro.
 */
export async function handleTurnTimeout(tableId: string, now = new Date()): Promise<Date | null> {
  const result = await prisma.$transaction(async (tx) => {
    const table = await lockTable(tx, tableId);
    // Mesa removida ou encerrada: o cronometro simplesmente para
    if (!table || table.status !== 'PLAYING' || !table.state || !table.turnDeadline) {
      return { deadline: null, moved: false };
    }
    // O jogador pode ter agido no ultimo instante: so age se o prazo realmente venceu
    if (table.turnDeadline.getTime() > now.getTime()) {
      return { deadline: table.turnDeadline, moved: false };
    }

    const adapter = adapterOf(table);
    const seats = await tx.gameSeat.findMany({ where: { tableId } });
    const acting = adapter.actingSeat(table.state);
    const seat = seats.find((candidate) => candidate.seat === acting);
    if (seat && !seat.isAway) {
      const timeouts = seat.timeouts + 1;
      const isAway = timeouts >= 2;
      await tx.gameSeat.update({ where: { id: seat.id }, data: { timeouts, isAway } });
      seat.timeouts = timeouts;
      seat.isAway = isAway;
      if (isAway) {
        logger.info('Jogador marcado como ausente', { tableId, game: table.game, seat: seat.seat });
      }
    }

    const deadline = await advanceTable(tx, table, seats, {
      seat: acting,
      action: adapter.autoAction(table.state, acting),
      automatic: true,
    });
    return { deadline, moved: true };
  });

  if (result.moved) {
    await publishTable(tableId);
  }
  return result.deadline;
}

/** O jogador ausente volta: retoma o controle, com o prazo normal se for a vez dele. */
export async function returnToTable(game: GameName, userId: string, tableId: string) {
  const deadline = await prisma.$transaction(async (tx) => {
    const { table, seats } = await lockGameTable(tx, game, tableId);
    const mySeat = seats.find((seat) => seat.userId === userId);
    if (!mySeat) {
      throw new AppError('Você não está nesta mesa', 403);
    }
    if (table.status !== 'PLAYING' || !table.state) {
      return null;
    }

    await tx.gameSeat.update({ where: { id: mySeat.id }, data: { timeouts: 0, isAway: false } });
    const adapter = adapterOf(table);
    if (adapter.actingSeat(table.state) !== mySeat.seat) {
      return table.turnDeadline;
    }
    const fresh = new Date(Date.now() + adapter.turnSeconds() * 1000);
    await tx.gameTable.update({ where: { id: tableId }, data: { turnDeadline: fresh } });
    return fresh;
  });

  scheduleTurnTimeout(tableId, deadline);
  await publishTable(tableId);
  const table = await loadTable(tableId);
  return table ? tableViewFor(table, userId) : null;
}

/** Ao iniciar o servidor, religa os cronometros das partidas em andamento a partir do banco. */
export async function restoreTurnTimers(): Promise<number> {
  const playing = await prisma.gameTable.findMany({
    where: { status: 'PLAYING', turnDeadline: { not: null } },
    select: { id: true, turnDeadline: true },
  });
  playing.forEach((table) => scheduleTurnTimeout(table.id, table.turnDeadline));
  return playing.length;
}

registerTurnTimeoutHandler((tableId) => handleTurnTimeout(tableId));

/** Mesa ativa do jogador neste jogo (aguardando ou em jogo), ou null. */
export async function getActiveTable(game: GameName, userId: string) {
  const seat = await prisma.gameSeat.findFirst({
    where: { userId, table: { game, status: { in: [...ACTIVE_STATUSES] } } },
  });
  if (!seat) return null;
  const table = await loadTable(seat.tableId);
  return table ? tableViewFor(table, userId) : null;
}

/** Qualquer mesa em que o jogador sentou (ex.: para ver o resultado depois do fim). */
export async function getTableForPlayer(game: GameName, userId: string, tableId: string) {
  const table = await loadTable(tableId);
  if (!table || table.game !== game || !table.seats.some((seat) => seat.userId === userId)) {
    throw new AppError('Mesa não encontrada', 404);
  }
  return tableViewFor(table, userId);
}

/** Cancela mesas que nao completaram no prazo e devolve as chaves. */
export async function cancelStaleQueues(now = new Date()): Promise<number> {
  const stale = await prisma.gameTable.findMany({
    where: { status: 'WAITING', createdAt: { lt: new Date(now.getTime() - queueTimeoutMs()) } },
    select: { id: true, game: true, mode: true, teamMode: true, stake: true },
  });

  let cancelled = 0;
  for (const candidate of stale) {
    const userIds = await prisma.$transaction(async (tx) => {
      await lockQueue(tx, candidate);
      const table = await lockTable(tx, candidate.id);
      if (!table || table.status !== 'WAITING') return null;

      const seats = await tx.gameSeat.findMany({ where: { tableId: table.id } });
      await refundSeats(tx, table, seats);
      await tx.gameTable.update({
        where: { id: table.id },
        data: { status: 'CANCELLED', prizePool: 0, finishedAt: new Date() },
      });
      return seats.map((seat) => seat.userId);
    });

    if (userIds) {
      cancelled += 1;
      logger.info('Mesa cancelada por falta de jogadores', {
        tableId: candidate.id,
        game: candidate.game,
        players: userIds.length,
      });
      await publishTable(candidate.id);
    }
  }
  return cancelled;
}

/** Partidas encerradas do jogador neste jogo (vencidas, perdidas ou canceladas), da mais recente para a mais antiga. */
export async function listMyMatches(game: GameName, userId: string, { limit, cursor }: HistoryPage) {
  const adapter = ADAPTERS[game];
  const tables = await prisma.gameTable.findMany({
    where: { game, status: { in: ['FINISHED', 'CANCELLED'] }, seats: { some: { userId } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { seats: { where: { userId } } },
  });

  const hasMore = tables.length > limit;
  const items = tables.slice(0, limit).map((table) => {
    const mySeat = table.seats[0];
    const won = table.state ? adapter.winnerSeats(table.state).includes(mySeat.seat) : false;
    return {
      tableId: table.id,
      mode: table.mode,
      teamMode: table.teamMode,
      stake: table.stake,
      status: table.status,
      playedAt: (table.startedAt ?? table.createdAt).toISOString(),
      outcome: table.status === 'CANCELLED' ? 'CANCELLED' : won ? 'WON' : 'LOST',
      mySeat: mySeat.seat,
      ...(table.state ? adapter.summary(table.state) : { reason: null }),
      prizeWon: mySeat.prizeAmount?.toString() ?? '0',
    };
  });

  return { items, nextCursor: hasMore ? items[items.length - 1].tableId : null };
}

const tableSummary = (table: GameTable) => ({
  id: table.id,
  mode: table.mode,
  teamMode: table.teamMode,
  stake: table.stake,
  status: table.status,
  prizePool: table.prizePool.toString(),
  createdAt: table.createdAt.toISOString(),
  startedAt: table.startedAt?.toISOString() ?? null,
  finishedAt: table.finishedAt?.toISOString() ?? null,
});

/** Lista de mesas de um jogo para o painel admin, com os jogadores. */
export async function listTablesForAdmin(game: GameName, status?: GameTable['status']) {
  const adapter = ADAPTERS[game];
  const tables = await prisma.gameTable.findMany({
    where: { game, ...(status ? { status } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { seats: { include: { user: { select: { name: true, email: true } } } } },
  });

  return tables.map((table) => ({
    ...tableSummary(table),
    moveCount: table.state ? adapter.moveCount(table.state) : 0,
    players: table.seats
      .sort((a, b) => a.seat - b.seat)
      .map((seat) => ({ seat: seat.seat, name: seat.user.name, email: seat.user.email })),
  }));
}

/** Tudo sobre uma mesa, para resolver reclamacoes: maos de todos, resultado e cada jogada registrada. */
export async function getTableForAdmin(game: GameName, tableId: string) {
  const table = await prisma.gameTable.findUnique({
    where: { id: tableId },
    include: {
      seats: { include: { user: { select: { name: true, email: true } } } },
      moves: { orderBy: { moveNumber: 'asc' } },
    },
  });
  if (!table || table.game !== game) {
    throw new AppError('Mesa não encontrada', 404);
  }

  const adapter = ADAPTERS[game];
  return {
    ...tableSummary(table),
    turnDeadline: table.turnDeadline?.toISOString() ?? null,
    ...(table.state ? adapter.summary(table.state) : {}),
    players: table.seats
      .sort((a, b) => a.seat - b.seat)
      .map((seat) => ({
        seat: seat.seat,
        name: seat.user.name,
        email: seat.user.email,
        timeouts: seat.timeouts,
        away: seat.isAway,
        prizeAmount: seat.prizeAmount?.toString() ?? null,
        hand: table.state ? adapter.handOf(table.state, seat.seat) : null,
      })),
    moves: table.moves.map((move) => ({
      moveNumber: move.moveNumber,
      seat: move.seat,
      action: move.action,
      automatic: move.automatic,
      createdAt: move.createdAt.toISOString(),
    })),
  };
}
