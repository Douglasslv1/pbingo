import { GameSeat, GameTable, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { HistoryPage } from '../../utils/pagination';
import { MAX_DAILY_WINS_VS_SAME } from '../ranking/ranking.service';

type Tx = Prisma.TransactionClient;
export type VenoxReason = 'WIN' | 'DAILY' | 'TOURNAMENT_ENTRY' | 'TOURNAMENT_REFUND' | 'TOURNAMENT_PRIZE';

export const VENOX_PER_WIN = 10;
export const VENOX_DAILY = 2;
const TIME_ZONE = 'America/Sao_Paulo';

/** Data de hoje no horario de Brasilia (AAAA-MM-DD): a visita diaria vira a meia-noite de Brasilia. */
const todayBrt = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(now);

/** Lanca Venox (negativo debita) uma unica vez por (motivo, ref). Retorna se lancou. */
export async function addVenox(tx: Tx, userId: string, amount: number, reason: VenoxReason, ref: string): Promise<boolean> {
  const inserted = await tx.$queryRaw<unknown[]>`
    INSERT INTO venox_ledger (user_id, amount, reason, ref) VALUES (${userId}::uuid, ${amount}, ${reason}, ${ref})
    ON CONFLICT (user_id, reason, ref) DO NOTHING RETURNING id
  `;
  if (inserted.length === 0) return false;
  await tx.user.update({ where: { id: userId }, data: { venox: { increment: amount } } });
  return true;
}

/**
 * Vencedores de uma mesa encerrada ganham Venox. Como no ranking, so contam ate 3 vitorias por dia
 * contra os mesmos adversarios (somando todos os jogos), para nao valer a pena combinar resultados.
 * Empate (sem vencedores) e partida de torneio nao rendem. Chamado depois de marcar os vencedores, na transacao da mesa.
 */
export async function rewardWinners(tx: Tx, table: GameTable, seats: GameSeat[], winnerSeats: number[]): Promise<void> {
  // No torneio o premio e o pote: vitoria de chave nao rende os 10 Venox
  if (table.tournamentId) return;
  const losers = seats.filter((seat) => !winnerSeats.includes(seat.seat)).map((seat) => seat.userId).sort();
  if (winnerSeats.length === 0 || losers.length === 0) return;

  for (const winner of seats.filter((seat) => winnerSeats.includes(seat.seat))) {
    const [{ wins }] = await tx.$queryRaw<Array<{ wins: number }>>`
      SELECT COUNT(*)::int AS wins
      FROM game_seats w JOIN game_tables t ON t.id = w.table_id
      WHERE w.user_id = ${winner.userId}::uuid AND w.is_winner AND t.status = 'FINISHED'
        AND (t.finished_at AT TIME ZONE ${TIME_ZONE})::date = ${todayBrt()}::date
        AND (SELECT string_agg(l.user_id::text, ',' ORDER BY l.user_id) FROM game_seats l WHERE l.table_id = t.id AND NOT l.is_winner) = ${losers.join(',')}
    `;
    if (wins <= MAX_DAILY_WINS_VS_SAME) {
      await addVenox(tx, winner.userId, VENOX_PER_WIN, 'WIN', table.id);
    }
  }
}

/** Saldo e se a visita de hoje ja foi resgatada. */
export async function getVenox(userId: string) {
  const [user, daily] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { venox: true } }),
    prisma.venoxLedger.findUnique({ where: { userId_reason_ref: { userId, reason: 'DAILY', ref: todayBrt() } } }),
  ]);
  return { balance: user.venox, dailyClaimed: daily !== null, dailyAmount: VENOX_DAILY, perWin: VENOX_PER_WIN };
}

/** Resgata a visita diaria (uma vez por dia de Brasilia; repetir nao credita de novo). */
export async function claimDaily(userId: string) {
  const claimed = await prisma.$transaction((tx) => addVenox(tx, userId, VENOX_DAILY, 'DAILY', todayBrt()));
  return { claimed, ...(await getVenox(userId)) };
}

/** Extrato de Venox, do mais recente para o mais antigo, paginado por cursor. */
export async function listVenoxHistory(userId: string, { limit, cursor }: HistoryPage) {
  const rows = await prisma.venoxLedger.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const items = rows.slice(0, limit).map(({ id, amount, reason, createdAt }) => ({ id, amount, reason, createdAt: createdAt.toISOString() }));
  return { items, nextCursor: rows.length > limit ? items[items.length - 1].id : null };
}
