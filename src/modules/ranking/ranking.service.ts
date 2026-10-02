import { Prisma } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { displayName } from '../profile/nickname';

export type RankingGame = 'BINGO' | 'DOMINO' | 'TRUCO' | 'DAMAS' | 'XADREZ' | 'LUDO';
export type RankingPeriod = 'month' | 'all';

/** Partidas minimas no periodo para entrar no ranking (evita 1 jogo e 100% de vitorias no topo). */
export const MIN_MATCHES = 5;
/** Vitorias contra o mesmo adversario no mesmo dia que contam no ranking (desestimula combinar resultados). */
export const MAX_DAILY_WINS_VS_SAME = 3;
const TOP = 50;
const TIME_ZONE = 'America/Sao_Paulo';

interface Row {
  user_id: string;
  matches: number;
  wins: number;
}

/** Inicio do periodo: o mes corrente no horario de Brasilia, ou desde sempre. */
const sinceOf = (period: RankingPeriod) =>
  period === 'month'
    ? Prisma.sql`date_trunc('month', now() AT TIME ZONE ${TIME_ZONE}) AT TIME ZONE ${TIME_ZONE}`
    : Prisma.sql`'-infinity'::timestamptz`;

/** Domino e truco: partidas encerradas e vitorias, com o limite diario contra o mesmo adversario. */
function tableRows(game: Exclude<RankingGame, 'BINGO'>, period: RankingPeriod) {
  return prisma.$queryRaw<Row[]>`
    WITH seats AS (
      SELECT s.user_id, s.table_id, s.is_winner, t.finished_at
      FROM game_seats s JOIN game_tables t ON t.id = s.table_id
      WHERE t.game = ${game} AND t.status = 'FINISHED' AND t.finished_at >= ${sinceOf(period)}
    ),
    wins AS (
      SELECT w.user_id,
        ROW_NUMBER() OVER (
          PARTITION BY w.user_id,
            (w.finished_at AT TIME ZONE ${TIME_ZONE})::date,
            (SELECT string_agg(l.user_id::text, ',' ORDER BY l.user_id) FROM seats l WHERE l.table_id = w.table_id AND NOT l.is_winner)
          ORDER BY w.finished_at
        ) AS nth
      FROM seats w WHERE w.is_winner
    )
    SELECT s.user_id, COUNT(*)::int AS matches,
      (SELECT COUNT(*) FROM wins c WHERE c.user_id = s.user_id AND c.nth <= ${MAX_DAILY_WINS_VS_SAME})::int AS wins
    FROM seats s
    GROUP BY s.user_id
    HAVING COUNT(*) >= ${MIN_MATCHES}
  `;
}

/** Numeros da sorte: rodadas jogadas e vencidas (jogo de sorte, sem limite por adversario). */
function bingoRows(period: RankingPeriod) {
  return prisma.$queryRaw<Row[]>`
    SELECT t.user_id, COUNT(DISTINCT t.round_id)::int AS matches,
      (COUNT(DISTINCT t.round_id) FILTER (WHERE t.is_winner))::int AS wins
    FROM tickets t JOIN rounds r ON r.id = t.round_id
    WHERE r.status = 'FINISHED' AND r.ended_at >= ${sinceOf(period)}
    GROUP BY t.user_id
    HAVING COUNT(DISTINCT t.round_id) >= ${MIN_MATCHES}
  `;
}

/**
 * Ranking de um jogo: mais vitorias primeiro; empate decidido pelo % de vitorias e depois por mais
 * partidas. Mostra so o apelido (nunca nome real nem premios) e a posicao de quem esta vendo.
 */
export async function getRanking(game: RankingGame, period: RankingPeriod, viewerId: string | null) {
  const rows = game === 'BINGO' ? await bingoRows(period) : await tableRows(game, period);
  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((row) => row.user_id) } },
    select: { id: true, nickname: true, playerNumber: true },
  });
  const userById = new Map(users.map((user) => [user.id, user]));

  const entries = rows
    .map((row) => ({ ...row, winRate: row.wins / row.matches }))
    .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || b.matches - a.matches)
    .map((row, index) => ({
      position: index + 1,
      name: displayName(userById.get(row.user_id)!),
      wins: row.wins,
      matches: row.matches,
      winRate: Math.round(row.winRate * 100),
      isMe: row.user_id === viewerId,
    }));

  return {
    game,
    period,
    minMatches: MIN_MATCHES,
    maxDailyWinsVsSame: game === 'BINGO' ? null : MAX_DAILY_WINS_VS_SAME,
    // Jogo hoje gratuito: o ranking vale normalmente e e das partidas gratuitas
    free:
      (game === 'DOMINO' && env.dominoFree) ||
      (['DAMAS', 'XADREZ'].includes(game) && env.boardGamesFree) ||
      (game === 'LUDO' && env.ludoFree),
    entries: entries.slice(0, TOP),
    me: entries.find((entry) => entry.isMe) ?? null,
  };
}
