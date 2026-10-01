import { DominoSeat, DominoTable, Prisma } from '@prisma/client';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/errors';
import { HistoryPage } from '../../utils/pagination';
import { emitToUser } from '../../websocket/socket';
import { splitPrizeInCents } from '../rounds/round.settlement';
import { applyAction, autoAction, dealGame, DominoRuleError, hasOnlyForcedAction, viewFor } from './domino.engine';
import { registerTurnTimeoutHandler, scheduleTurnTimeout } from './domino.scheduler';
import { DominoAction, DominoMode, DominoState, seatsFor, TeamMode } from './domino.types';

type Tx = Prisma.TransactionClient;
type TableWithSeats = DominoTable & { seats: Array<DominoSeat & { user: { name: string } }> };

export interface QueueChoice {
  mode: DominoMode;
  teamMode: TeamMode;
}

const ACTIVE_STATUSES = ['WAITING', 'PLAYING'] as const;

const queueTimeoutMs = () => env.dominoQueueTimeoutMinutes * 60 * 1000;

/** Jogador ausente: o sistema joga por ele depois desse intervalo curto. */
export const AWAY_TURN_MS = 3000;

/** Prazo da proxima jogada: o tempo normal, ou o intervalo curto se o jogador da vez esta ausente. */
function nextDeadline(state: DominoState, seats: DominoSeat[], now = new Date()): Date | null {
  if (state.status !== 'PLAYING') return null;
  const away = seats.find((seat) => seat.seat === state.currentSeat)?.isAway ?? false;
  return new Date(now.getTime() + (away ? AWAY_TURN_MS : env.dominoTurnSeconds * 1000));
}

/** Serializa entradas e saidas da mesma fila, para duas pessoas nao abrirem mesas separadas ao mesmo tempo. */
async function lockQueue(tx: Tx, mode: string, teamMode: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`domino:${mode}:${teamMode}`}))`;
}

async function lockTable(tx: Tx, tableId: string): Promise<DominoTable | null> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM domino_tables WHERE id = ${tableId}::uuid FOR UPDATE`;
  return rows.length > 0 ? tx.dominoTable.findUnique({ where: { id: tableId } }) : null;
}

/** Devolve as chaves das cadeiras e registra no extrato. */
async function refundSeats(tx: Tx, seats: DominoSeat[]): Promise<void> {
  const paid = seats.filter((seat) => seat.creditsSpent > 0);
  const userIds = [...new Set(paid.map((seat) => seat.userId))].sort();
  if (userIds.length === 0) return;

  await tx.$queryRaw`SELECT user_id FROM user_credits WHERE user_id = ANY(${userIds}::uuid[]) ORDER BY user_id FOR UPDATE`;
  for (const seat of paid) {
    await tx.userCredit.update({ where: { userId: seat.userId }, data: { balance: { increment: seat.creditsSpent } } });
    await tx.transaction.create({
      data: {
        userId: seat.userId,
        type: 'KEY_REFUND',
        amountCredits: seat.creditsSpent,
        status: 'COMPLETED',
        game: 'DOMINO',
      },
    });
  }
}

/** Divide o pote entre os lugares vencedores e credita o saldo de premios de cada um. */
async function payWinners(tx: Tx, table: DominoTable, state: DominoState, seats: DominoSeat[]): Promise<void> {
  if (table.prizePool.isZero()) return;
  const winnerSeats = state.result?.winnerSeats ?? [];
  const winners = seats.filter((seat) => winnerSeats.includes(seat.seat)).sort((a, b) => a.seat - b.seat);
  const shares = splitPrizeInCents(Math.round(Number(table.prizePool) * 100), winners.length);

  const userIds = [...new Set(winners.map((seat) => seat.userId))].sort();
  await tx.$queryRaw`SELECT user_id FROM user_prizes WHERE user_id = ANY(${userIds}::uuid[]) ORDER BY user_id FOR UPDATE`;

  for (const [index, seat] of winners.entries()) {
    const prize = shares[index] / 100;
    await tx.dominoSeat.update({ where: { id: seat.id }, data: { prizeAmount: prize } });
    await tx.userPrize.update({ where: { userId: seat.userId }, data: { balanceFiat: { increment: prize } } });
    await tx.transaction.create({
      data: { userId: seat.userId, type: 'PRIZE_PAYOUT', amountFiat: prize, status: 'COMPLETED', game: 'DOMINO' },
    });
  }
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** Visao da mesa para um jogador: so a mao dele fica visivel ate o fim da partida. */
export function tableViewFor(table: TableWithSeats, userId: string) {
  const mySeat = table.seats.find((seat) => seat.userId === userId)?.seat ?? null;
  const state = table.state as unknown as DominoState | null;

  return {
    id: table.id,
    mode: table.mode,
    teamMode: table.teamMode,
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
    game: state && mySeat !== null ? viewFor(state, mySeat) : null,
  };
}

async function loadTable(tableId: string): Promise<TableWithSeats | null> {
  return prisma.dominoTable.findUnique({
    where: { id: tableId },
    include: { seats: { include: { user: { select: { name: true } } } } },
  });
}

/** Envia a cada jogador da mesa (e a quem acabou de sair) a visao atualizada. */
async function publishTable(tableId: string, extraUserIds: string[] = []): Promise<void> {
  const table = await loadTable(tableId);
  if (!table) return;
  for (const seat of table.seats) {
    emitToUser(seat.userId, 'domino:table', tableViewFor(table, seat.userId));
  }
  for (const userId of extraUserIds) {
    emitToUser(userId, 'domino:left', { tableId, status: table.status });
  }
}

/** Entra na fila da modalidade escolhida, pagando 1 chave (nada no modo gratuito). Com a mesa cheia a partida comeca. */
export async function joinQueue(userId: string, choice: QueueChoice) {
  if (!env.dominoEnabled) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (user?.role !== 'ADMIN') {
      throw new AppError('O dominó ainda não está disponível', 403);
    }
  }

  const price = env.dominoFree ? 0 : env.ticketPriceCredits;
  const contribution = env.dominoFree ? 0 : env.prizeContributionPerTicket;

  const started = await prisma.$transaction(async (tx) => {
    // Travar a carteira primeiro serializa pedidos simultaneos do mesmo jogador
    const credits = await tx.$queryRaw<Array<{ balance: number }>>`
      SELECT balance FROM user_credits WHERE user_id = ${userId}::uuid FOR UPDATE
    `;

    const active = await tx.dominoSeat.findFirst({
      where: { userId, table: { status: { in: [...ACTIVE_STATUSES] } } },
    });
    if (active) {
      throw new AppError('Você já está em uma mesa de dominó', 409);
    }
    if ((credits[0]?.balance ?? 0) < price) {
      throw new AppError('Saldo de chaves insuficiente para entrar na mesa', 400);
    }

    await lockQueue(tx, choice.mode, choice.teamMode);
    const table =
      (await tx.dominoTable.findFirst({
        where: { status: 'WAITING', mode: choice.mode, teamMode: choice.teamMode },
        orderBy: { createdAt: 'asc' },
        include: { seats: true },
      })) ??
      (await tx.dominoTable.create({
        data: { mode: choice.mode, teamMode: choice.teamMode },
        include: { seats: true },
      }));

    const taken = new Set(table.seats.map((seat) => seat.seat));
    const seatCount = seatsFor(choice.teamMode);
    const seat = Array.from({ length: seatCount }, (_, index) => index).find((candidate) => !taken.has(candidate));
    if (seat === undefined) {
      throw new AppError('Mesa cheia, tente novamente', 409);
    }

    if (price > 0) {
      await tx.userCredit.update({ where: { userId }, data: { balance: { decrement: price } } });
      await tx.transaction.create({
        data: { userId, type: 'SPEND_KEY', amountCredits: price, status: 'COMPLETED', game: 'DOMINO' },
      });
    }
    await tx.dominoSeat.create({
      data: {
        tableId: table.id,
        userId,
        seat,
        creditsSpent: price,
        prizeContribution: contribution,
      },
    });

    const isFull = table.seats.length + 1 === seatCount;
    const dealt = isFull ? dealGame(choice.mode, choice.teamMode) : null;
    const updated = await tx.dominoTable.update({
      where: { id: table.id },
      data: {
        prizePool: { increment: contribution },
        ...(dealt
          ? {
              status: 'PLAYING',
              startedAt: new Date(),
              state: dealt as unknown as Prisma.InputJsonValue,
              turnDeadline: new Date(Date.now() + env.dominoTurnSeconds * 1000),
            }
          : {}),
      },
    });

    return { id: table.id, deadline: updated.turnDeadline };
  });

  const tableId = started.id;
  scheduleTurnTimeout(tableId, started.deadline);
  await publishTable(tableId);
  const table = await loadTable(tableId);
  return table ? tableViewFor(table, userId) : null;
}

/** Sai da fila antes da partida comecar, recuperando a chave. */
export async function leaveQueue(userId: string) {
  const left = await prisma.$transaction(async (tx) => {
    const seat = await tx.dominoSeat.findFirst({
      where: { userId, table: { status: 'WAITING' } },
      include: { table: true },
    });
    if (!seat) {
      throw new AppError('Você não está aguardando em nenhuma mesa', 409);
    }

    await lockQueue(tx, seat.table.mode, seat.table.teamMode);
    const table = await lockTable(tx, seat.tableId);
    if (!table || table.status !== 'WAITING') {
      throw new AppError('A partida já começou - não é mais possível sair', 409);
    }

    await refundSeats(tx, [seat]);
    await tx.dominoSeat.delete({ where: { id: seat.id } });
    const remaining = await tx.dominoSeat.count({ where: { tableId: table.id } });
    await tx.dominoTable.update({
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
  action: DominoAction;
  automatic: boolean;
}

/**
 * Aplica uma jogada (do jogador ou automatica) e, em seguida, as jogadas forcadas (passar/comprar
 * sem opcao), gravando cada uma. Define o prazo da proxima jogada e, se a partida terminar,
 * paga os vencedores - tudo na transacao da mesa bloqueada.
 */
async function advanceTable(tx: Tx, table: DominoTable, seats: DominoSeat[], first: Advance): Promise<Date | null> {
  let state = table.state as unknown as DominoState;
  const moves: Array<Advance & { moveNumber: number }> = [];

  try {
    state = applyAction(state, first.seat, first.action);
    moves.push({ ...first, moveNumber: state.moveCount });

    while (state.status === 'PLAYING' && hasOnlyForcedAction(state)) {
      const seat = state.currentSeat;
      const forced = autoAction(state, seat);
      state = applyAction(state, seat, forced);
      moves.push({ seat, action: forced, automatic: true, moveNumber: state.moveCount });
    }
  } catch (err) {
    if (err instanceof DominoRuleError) {
      throw new AppError(err.message, 422);
    }
    throw err;
  }

  await tx.dominoMove.createMany({
    data: moves.map((move) => ({
      tableId: table.id,
      seat: move.seat,
      moveNumber: move.moveNumber,
      action: move.action as unknown as Prisma.InputJsonValue,
      automatic: move.automatic,
    })),
  });

  const finished = state.status === 'FINISHED';
  const deadline = nextDeadline(state, seats);
  await tx.dominoTable.update({
    where: { id: table.id },
    data: {
      state: state as unknown as Prisma.InputJsonValue,
      turnDeadline: deadline,
      ...(finished ? { status: 'FINISHED', finishedAt: new Date() } : {}),
    },
  });
  if (finished) {
    await payWinners(tx, table, state, seats);
  }
  return deadline;
}

async function lockPlayingTable(tx: Tx, tableId: string) {
  const table = await lockTable(tx, tableId);
  if (!table) {
    throw new AppError('Mesa não encontrada', 404);
  }
  const seats = await tx.dominoSeat.findMany({ where: { tableId } });
  return { table, seats };
}

/** Jogada do jogador. Jogar tambem tira a marca de ausente e zera os tempos esgotados. */
export async function playMove(userId: string, tableId: string, action: DominoAction) {
  const deadline = await prisma.$transaction(async (tx) => {
    const { table, seats } = await lockPlayingTable(tx, tableId);
    const mySeat = seats.find((seat) => seat.userId === userId);
    if (!mySeat) {
      throw new AppError('Você não está nesta mesa', 403);
    }
    if (table.status !== 'PLAYING' || !table.state) {
      throw new AppError('A partida não está em andamento', 409);
    }

    if (mySeat.timeouts > 0 || mySeat.isAway) {
      await tx.dominoSeat.update({ where: { id: mySeat.id }, data: { timeouts: 0, isAway: false } });
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
 * Prazo da jogada vencido: o sistema joga pelo jogador da vez. Dois tempos esgotados seguidos
 * marcam o jogador como ausente (o sistema passa a jogar por ele a cada poucos segundos).
 * Retorna o prazo seguinte para o cronometro.
 */
export async function handleTurnTimeout(tableId: string, now = new Date()): Promise<Date | null> {
  const result = await prisma.$transaction(async (tx) => {
    const table = await lockTable(tx, tableId);
    // Mesa removida ou encerrada: o cronometro simplesmente para
    if (!table || table.status !== 'PLAYING' || !table.state || !table.turnDeadline) {
      return { deadline: null, moved: false };
    }
    // O jogador pode ter jogado no ultimo instante: so age se o prazo realmente venceu
    if (table.turnDeadline.getTime() > now.getTime()) {
      return { deadline: table.turnDeadline, moved: false };
    }

    const seats = await tx.dominoSeat.findMany({ where: { tableId } });
    const state = table.state as unknown as DominoState;
    const seat = seats.find((candidate) => candidate.seat === state.currentSeat);
    if (seat && !seat.isAway) {
      const timeouts = seat.timeouts + 1;
      const isAway = timeouts >= 2;
      await tx.dominoSeat.update({ where: { id: seat.id }, data: { timeouts, isAway } });
      seat.timeouts = timeouts;
      seat.isAway = isAway;
      if (isAway) {
        logger.info('Jogador de dominó marcado como ausente', { tableId, seat: seat.seat });
      }
    }

    const deadline = await advanceTable(tx, table, seats, {
      seat: state.currentSeat,
      action: autoAction(state, state.currentSeat),
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
export async function returnToTable(userId: string, tableId: string) {
  const deadline = await prisma.$transaction(async (tx) => {
    const { table, seats } = await lockPlayingTable(tx, tableId);
    const mySeat = seats.find((seat) => seat.userId === userId);
    if (!mySeat) {
      throw new AppError('Você não está nesta mesa', 403);
    }
    if (table.status !== 'PLAYING' || !table.state) {
      return null;
    }

    await tx.dominoSeat.update({ where: { id: mySeat.id }, data: { timeouts: 0, isAway: false } });
    const state = table.state as unknown as DominoState;
    if (state.currentSeat !== mySeat.seat) {
      return table.turnDeadline;
    }
    const fresh = new Date(Date.now() + env.dominoTurnSeconds * 1000);
    await tx.dominoTable.update({ where: { id: tableId }, data: { turnDeadline: fresh } });
    return fresh;
  });

  scheduleTurnTimeout(tableId, deadline);
  await publishTable(tableId);
  const table = await loadTable(tableId);
  return table ? tableViewFor(table, userId) : null;
}

/** Ao iniciar o servidor, religa os cronometros das partidas em andamento a partir do banco. */
export async function restoreTurnTimers(): Promise<number> {
  const playing = await prisma.dominoTable.findMany({
    where: { status: 'PLAYING', turnDeadline: { not: null } },
    select: { id: true, turnDeadline: true },
  });
  playing.forEach((table) => scheduleTurnTimeout(table.id, table.turnDeadline));
  return playing.length;
}

registerTurnTimeoutHandler((tableId) => handleTurnTimeout(tableId));

/** Mesa ativa do jogador (aguardando ou em jogo), ou null. */
export async function getActiveTable(userId: string) {
  const seat = await prisma.dominoSeat.findFirst({
    where: { userId, table: { status: { in: [...ACTIVE_STATUSES] } } },
  });
  if (!seat) return null;
  const table = await loadTable(seat.tableId);
  return table ? tableViewFor(table, userId) : null;
}

/** Qualquer mesa em que o jogador sentou (ex.: para ver o resultado depois do fim). */
export async function getTableForPlayer(userId: string, tableId: string) {
  const table = await loadTable(tableId);
  if (!table || !table.seats.some((seat) => seat.userId === userId)) {
    throw new AppError('Mesa não encontrada', 404);
  }
  return tableViewFor(table, userId);
}

/** Cancela mesas que nao completaram 4 jogadores no prazo e devolve as chaves. */
export async function cancelStaleQueues(now = new Date()): Promise<number> {
  const stale = await prisma.dominoTable.findMany({
    where: { status: 'WAITING', createdAt: { lt: new Date(now.getTime() - queueTimeoutMs()) } },
    select: { id: true, mode: true, teamMode: true },
  });

  let cancelled = 0;
  for (const candidate of stale) {
    const userIds = await prisma.$transaction(async (tx) => {
      await lockQueue(tx, candidate.mode, candidate.teamMode);
      const table = await lockTable(tx, candidate.id);
      if (!table || table.status !== 'WAITING') return null;

      const seats = await tx.dominoSeat.findMany({ where: { tableId: table.id } });
      await refundSeats(tx, seats);
      await tx.dominoTable.update({
        where: { id: table.id },
        data: { status: 'CANCELLED', prizePool: 0, finishedAt: new Date() },
      });
      return seats.map((seat) => seat.userId);
    });

    if (userIds) {
      cancelled += 1;
      logger.info('Mesa de dominó cancelada por falta de jogadores', { tableId: candidate.id, players: userIds.length });
      await publishTable(candidate.id);
    }
  }
  return cancelled;
}

/** Partidas encerradas do jogador (vencidas, perdidas ou canceladas), da mais recente para a mais antiga. */
export async function listMyMatches(userId: string, { limit, cursor }: HistoryPage) {
  const tables = await prisma.dominoTable.findMany({
    where: { status: { in: ['FINISHED', 'CANCELLED'] }, seats: { some: { userId } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { seats: { where: { userId } } },
  });

  const hasMore = tables.length > limit;
  const items = tables.slice(0, limit).map((table) => {
    const mySeat = table.seats[0];
    const state = table.state as unknown as DominoState | null;
    const won = state?.result?.winnerSeats.includes(mySeat.seat) ?? false;
    return {
      tableId: table.id,
      mode: table.mode,
      teamMode: table.teamMode,
      status: table.status,
      playedAt: (table.startedAt ?? table.createdAt).toISOString(),
      outcome: table.status === 'CANCELLED' ? 'CANCELLED' : won ? 'WON' : 'LOST',
      reason: state?.result?.reason ?? null,
      prizeWon: mySeat.prizeAmount?.toString() ?? '0',
    };
  });

  return { items, nextCursor: hasMore ? items[items.length - 1].tableId : null };
}

/** Lista de mesas para o painel admin, com os jogadores. */
export async function listTablesForAdmin(status?: DominoTable['status']) {
  const tables = await prisma.dominoTable.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { seats: { include: { user: { select: { name: true, email: true } } } } },
  });

  return tables.map((table) => ({
    id: table.id,
    mode: table.mode,
    teamMode: table.teamMode,
    status: table.status,
    prizePool: table.prizePool.toString(),
    createdAt: table.createdAt.toISOString(),
    startedAt: table.startedAt?.toISOString() ?? null,
    finishedAt: table.finishedAt?.toISOString() ?? null,
    moveCount: (table.state as unknown as DominoState | null)?.moveCount ?? 0,
    players: table.seats
      .sort((a, b) => a.seat - b.seat)
      .map((seat) => ({ seat: seat.seat, name: seat.user.name, email: seat.user.email })),
  }));
}

/** Tudo sobre uma mesa, para resolver reclamacoes: maos de todos, placar e cada jogada registrada. */
export async function getTableForAdmin(tableId: string) {
  const table = await prisma.dominoTable.findUnique({
    where: { id: tableId },
    include: {
      seats: { include: { user: { select: { name: true, email: true } } } },
      moves: { orderBy: { moveNumber: 'asc' } },
    },
  });
  if (!table) {
    throw new AppError('Mesa não encontrada', 404);
  }

  const state = table.state as unknown as DominoState | null;
  return {
    id: table.id,
    mode: table.mode,
    teamMode: table.teamMode,
    status: table.status,
    prizePool: table.prizePool.toString(),
    createdAt: table.createdAt.toISOString(),
    startedAt: table.startedAt?.toISOString() ?? null,
    finishedAt: table.finishedAt?.toISOString() ?? null,
    turnDeadline: table.turnDeadline?.toISOString() ?? null,
    players: table.seats
      .sort((a, b) => a.seat - b.seat)
      .map((seat) => ({
        seat: seat.seat,
        name: seat.user.name,
        email: seat.user.email,
        timeouts: seat.timeouts,
        away: seat.isAway,
        prizeAmount: seat.prizeAmount?.toString() ?? null,
        hand: state?.hands[seat.seat] ?? null,
      })),
    line: state?.line ?? [],
    boneyard: state?.boneyard ?? [],
    currentSeat: state?.currentSeat ?? null,
    result: state?.result ?? null,
    moves: table.moves.map((move) => ({
      moveNumber: move.moveNumber,
      seat: move.seat,
      action: move.action,
      automatic: move.automatic,
      createdAt: move.createdAt.toISOString(),
    })),
  };
}
