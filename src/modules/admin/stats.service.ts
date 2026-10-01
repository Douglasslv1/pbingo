import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { onlineCounts } from '../../websocket/socket';

const DAY_MS = 24 * 60 * 60 * 1000;

const distinctUsers = (where: Prisma.AccessLogWhereInput) =>
  prisma.accessLog.findMany({ where, distinct: ['userId'], select: { userId: true } }).then((rows) => rows.length);

const sumFiat = (where: Prisma.TransactionWhereInput) =>
  prisma.transaction
    .aggregate({ where: { ...where, status: 'COMPLETED' }, _sum: { amountFiat: true } })
    .then((result) => (result._sum.amountFiat ?? new Prisma.Decimal(0)).toString());

const byStatus = (rows: Array<{ status: string; _count: { _all: number } }>) =>
  Object.fromEntries(rows.map((row) => [row.status, row._count._all]));

/** Numeros gerais da plataforma para o painel admin. Acessos vem do AccessLog (guardado por 6 meses). */
export async function getPlatformStats(now = new Date()) {
  const since = (days: number) => new Date(now.getTime() - days * DAY_MS);

  const [total, newToday, newWeek, everLoggedIn, activeToday, activeWeek, online] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: since(1) } } }),
    prisma.user.count({ where: { createdAt: { gte: since(7) } } }),
    distinctUsers({ event: 'LOGIN' }),
    distinctUsers({ createdAt: { gte: since(1) } }),
    distinctUsers({ createdAt: { gte: since(7) } }),
    onlineCounts(),
  ]);

  const [pixIn, prizesPaid, withdrawals, rounds, tables, recentUsers] = await Promise.all([
    sumFiat({ type: 'PURCHASE_CREDITS' }),
    sumFiat({ type: 'PRIZE_PAYOUT' }),
    prisma.withdrawal.groupBy({ by: ['status'], _count: { _all: true }, _sum: { amountFiat: true } }),
    prisma.round.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.gameTable.groupBy({ by: ['game', 'status'], _count: { _all: true } }),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, name: true, email: true, createdAt: true },
    }),
  ]);

  return {
    users: { total, newToday, newWeek, everLoggedIn, activeToday, activeWeek, ...online },
    money: {
      pixIn,
      prizesPaid,
      withdrawals: Object.fromEntries(
        withdrawals.map((row) => [
          row.status,
          { count: row._count._all, amount: (row._sum.amountFiat ?? new Prisma.Decimal(0)).toString() },
        ]),
      ),
    },
    bingoRounds: byStatus(rounds),
    dominoTables: byStatus(tables.filter((row) => row.game === 'DOMINO')),
    trucoTables: byStatus(tables.filter((row) => row.game === 'TRUCO')),
    recentUsers: recentUsers.map((user) => ({ ...user, createdAt: user.createdAt.toISOString() })),
  };
}
