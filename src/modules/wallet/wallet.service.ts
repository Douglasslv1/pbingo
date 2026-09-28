import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/errors';

export async function getWallet(userId: string) {
  const [credits, prizes] = await Promise.all([
    prisma.userCredit.findUnique({ where: { userId } }),
    prisma.userPrize.findUnique({ where: { userId } }),
  ]);

  if (!credits || !prizes) {
    throw new AppError('Carteira nao encontrada para o usuario', 404);
  }

  return {
    credits: { balance: credits.balance },
    prizes: { balanceFiat: prizes.balanceFiat.toString() },
  };
}
