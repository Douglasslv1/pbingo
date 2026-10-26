import { Prisma, Withdrawal, WithdrawalStatus } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/errors';
import { WithdrawalInput } from './withdrawals.types';
import { assertCommissionWithdrawal, lockPartner } from '../partners/partners.service';

function toView(withdrawal: Withdrawal) {
  return {
    id: withdrawal.id,
    source: withdrawal.source,
    amountFiat: withdrawal.amountFiat.toString(),
    cpf: withdrawal.cpf,
    pixKeyType: withdrawal.pixKeyType,
    pixKey: withdrawal.pixKey,
    status: withdrawal.status,
    paymentReference: withdrawal.paymentReference,
    rejectionReason: withdrawal.rejectionReason,
    reviewedAt: withdrawal.reviewedAt?.toISOString() ?? null,
    createdAt: withdrawal.createdAt.toISOString(),
  };
}

/**
 * Registra a solicitacao de saque e debita o saldo sacavel imediatamente.
 * O pagamento e feito manualmente por um admin, que depois marca o saque
 * como pago ou o recusa (devolvendo o valor ao saldo).
 */
export async function requestWithdrawal(userId: string, input: WithdrawalInput) {
  if (input.amount < env.minWithdrawalBrl) {
    throw new AppError(`O valor mínimo para saque é R$ ${env.minWithdrawalBrl.toFixed(2)}`, 400);
  }

  return prisma.$transaction(async (tx) => {
    if (input.source === 'COMMISSIONS') {
      const partner = await assertCommissionWithdrawal(tx, userId, input.cpf);
      const cents = Math.round(input.amount * 100);
      if (Number(partner.balanceCents) < cents) throw new AppError('Saldo de comissões insuficiente ou com estornos a compensar', 400);
      await tx.partner.update({ where: { id: partner.id }, data: { balanceCents: { decrement: cents } } });
      const transaction = await tx.transaction.create({ data: { userId, type: 'WITHDRAWAL', game: 'PARTNER', amountFiat: input.amount, status: 'PENDING' } });
      const withdrawal = await tx.withdrawal.create({ data: { userId, transactionId: transaction.id, amountFiat: input.amount,
        cpf: input.cpf, pixKeyType: input.pixKeyType, pixKey: input.pixKey, source: 'COMMISSIONS' } });
      return { withdrawalId: withdrawal.id, transactionId: transaction.id, remainingBalance: ((Number(partner.balanceCents) - cents) / 100).toFixed(2) };
    }
    const rows = await tx.$queryRaw<Array<{ balance_fiat: string }>>`
      SELECT balance_fiat FROM user_prizes WHERE user_id = ${userId}::uuid FOR UPDATE
    `;
    const currentBalance = Number(rows[0]?.balance_fiat ?? 0);

    if (currentBalance < input.amount) {
      throw new AppError('Saldo de prêmios insuficiente para o saque solicitado', 400);
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

    const withdrawal = await tx.withdrawal.create({
      data: {
        userId,
        transactionId: transaction.id,
        amountFiat: input.amount,
        cpf: input.cpf,
        pixKeyType: input.pixKeyType,
        pixKey: input.pixKey,
      },
    });

    return {
      withdrawalId: withdrawal.id,
      transactionId: transaction.id,
      remainingBalance: prize.balanceFiat.toString(),
    };
  });
}

export async function listMyWithdrawals(userId: string) {
  const withdrawals = await prisma.withdrawal.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return withdrawals.map(toView);
}

export async function listWithdrawalsForReview(status?: WithdrawalStatus) {
  const withdrawals = await prisma.withdrawal.findMany({
    where: status ? { status } : {},
    // Pendentes em ordem de chegada (fila); historico do mais recente para o mais antigo
    orderBy: { createdAt: status === 'PENDING' ? 'asc' : 'desc' },
    take: 200,
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return withdrawals.map((withdrawal) => ({ ...toView(withdrawal), user: withdrawal.user }));
}

/** Bloqueia o saque e garante que ele ainda aguarda revisao (evita pagar/recusar duas vezes). */
async function lockPendingWithdrawal(tx: Prisma.TransactionClient, withdrawalId: string) {
  const rows = await tx.$queryRaw<Array<{ status: WithdrawalStatus }>>`
    SELECT status FROM withdrawals WHERE id = ${withdrawalId}::uuid FOR UPDATE
  `;
  if (rows.length === 0) {
    throw new AppError('Saque não encontrado', 404);
  }
  if (rows[0].status !== 'PENDING') {
    throw new AppError('Este saque já foi revisado', 409);
  }
}

export async function markWithdrawalPaid(withdrawalId: string, adminUserId: string, paymentReference: string) {
  return prisma.$transaction(async (tx) => {
    await lockPendingWithdrawal(tx, withdrawalId);
    const current = await tx.withdrawal.findUniqueOrThrow({ where: { id: withdrawalId } });
    if (current.source === 'COMMISSIONS') {
      const partner = await assertCommissionWithdrawal(tx, current.userId, current.cpf);
      if (Number(partner.balanceCents) < 0) throw new AppError('Há estornos a compensar. Recuse e revise o saque antes de pagar.', 409);
    }

    const withdrawal = await tx.withdrawal.update({
      where: { id: withdrawalId },
      data: { status: 'PAID', paymentReference, reviewedByUserId: adminUserId, reviewedAt: new Date() },
    });

    await tx.transaction.update({
      where: { id: withdrawal.transactionId },
      data: { status: 'COMPLETED', providerReference: paymentReference },
    });

    return toView(withdrawal);
  });
}

export async function rejectWithdrawal(withdrawalId: string, adminUserId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    await lockPendingWithdrawal(tx, withdrawalId);

    const withdrawal = await tx.withdrawal.update({
      where: { id: withdrawalId },
      data: { status: 'REJECTED', rejectionReason: reason, reviewedByUserId: adminUserId, reviewedAt: new Date() },
    });

    await tx.transaction.update({
      where: { id: withdrawal.transactionId },
      data: { status: 'REJECTED' },
    });

    if (withdrawal.source === 'COMMISSIONS') {
      const partner = await tx.partner.findUniqueOrThrow({ where: { userId: withdrawal.userId } });
      await lockPartner(tx, partner.id);
      await tx.partner.update({ where: { id: partner.id }, data: { balanceCents: { increment: Math.round(Number(withdrawal.amountFiat) * 100) } } });
    } else {
      await tx.$queryRaw`SELECT balance_fiat FROM user_prizes WHERE user_id = ${withdrawal.userId}::uuid FOR UPDATE`;
      await tx.userPrize.update({ where: { userId: withdrawal.userId }, data: { balanceFiat: { increment: withdrawal.amountFiat } } });
    }

    return toView(withdrawal);
  });
}
