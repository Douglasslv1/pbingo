import { prisma } from '../../lib/prisma';
import { MockPixInput } from './payments.types';

/**
 * Simula a confirmacao de um pagamento Pix vindo de um provedor externo.
 * Em producao este fluxo seria disparado por um webhook autenticado do
 * gateway de pagamento, apos confirmacao real da transacao.
 */
export async function confirmMockPixPurchase(userId: string, input: MockPixInput) {
  return prisma.$transaction(async (tx) => {
    const credits = await tx.userCredit.update({
      where: { userId },
      data: { balance: { increment: input.creditsAmount } },
    });

    await tx.transaction.create({
      data: {
        userId,
        type: 'PURCHASE_CREDITS',
        amountFiat: input.amountFiat,
        amountCredits: input.creditsAmount,
        status: 'COMPLETED',
      },
    });

    return { balance: credits.balance };
  });
}
