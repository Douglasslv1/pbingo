import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/errors';
import { HistoryPage } from '../../utils/pagination';

export async function getWallet(userId: string) {
  const [credits, prizes] = await Promise.all([
    prisma.userCredit.findUnique({ where: { userId } }),
    prisma.userPrize.findUnique({ where: { userId } }),
  ]);

  if (!credits || !prizes) {
    throw new AppError('Carteira não encontrada para o usuário', 404);
  }

  return {
    credits: { balance: credits.balance },
    prizes: { balanceFiat: prizes.balanceFiat.toString() },
  };
}

/**
 * Extrato do jogador, do mais recente para o mais antigo, paginado por cursor.
 * Compras de chaves so aparecem depois de pagas: QR codes Pix abandonados nao poluem o extrato.
 */
export async function listMyTransactions(userId: string, { limit, cursor }: HistoryPage) {
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      OR: [{ type: { not: 'PURCHASE_CREDITS' } }, { status: 'COMPLETED' }],
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = transactions.length > limit;
  const items = transactions.slice(0, limit).map((transaction) => ({
    id: transaction.id,
    type: transaction.type,
    status: transaction.status,
    amountFiat: transaction.amountFiat.toString(),
    amountCredits: transaction.amountCredits,
    game: transaction.game,
    createdAt: transaction.createdAt.toISOString(),
  }));

  return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
}
