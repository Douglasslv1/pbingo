import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/errors';
import { WithdrawalInput } from './withdrawals.types';

/**
 * Registra a solicitacao de saque e debita o saldo sacavel imediatamente.
 * A liquidacao bancaria real (envio do Pix/TED ao usuario) e um processo
 * externo que consome esta transacao com status PENDING.
 */
export async function requestWithdrawal(userId: string, input: WithdrawalInput) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ balance_fiat: string }>>`
      SELECT balance_fiat FROM user_prizes WHERE user_id = ${userId}::uuid FOR UPDATE
    `;
    const currentBalance = Number(rows[0]?.balance_fiat ?? 0);

    if (currentBalance < input.amount) {
      throw new AppError('Saldo de premios insuficiente para o saque solicitado', 400);
    }

    const prize = await tx.userPrize.update({
      where: { userId },
      data: { balanceFiat: { decrement: input.amount } },
    });

    const transaction = await tx.transaction.create({
      data: {
        userId,
        type: 'WITHDRAWAL',
        amountFiat: input.amount,
        status: 'PENDING',
      },
    });

    return { transactionId: transaction.id, remainingBalance: prize.balanceFiat.toString() };
  });
}
