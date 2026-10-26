import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { AppError } from '../../utils/errors';
import { mpOrderClient } from './mercadopago.client';
import { Transaction } from '@prisma/client';
import { settleRafflePayment } from '../raffles/raffles.service';

// Status de order (Orders API) que encerram a cobranca.
const ORDER_PAID_STATUSES = ['processed'];
const ORDER_FAILED_STATUSES = ['failed', 'canceled', 'expired'];

function assertMercadoPagoConfigured(): void {
  if (!env.mercadoPagoAccessToken) {
    throw new AppError('Integração com Mercado Pago não configurada (MERCADOPAGO_ACCESS_TOKEN ausente)', 503);
  }
}

export async function createPixCharge(userId: string, creditsAmount: number) {
  assertMercadoPagoConfigured();

  const amountFiat = Number((creditsAmount * env.creditPriceBrl).toFixed(2));

  const transaction = await prisma.transaction.create({
    data: {
      userId,
      type: 'PURCHASE_CREDITS',
      amountFiat,
      amountCredits: creditsAmount,
      status: 'PENDING',
    },
  });

  return createPixForTransaction(transaction);
}

/** Reuses the same provider idempotency key when recovering an interrupted charge. */
export async function createPixForTransaction(transaction: Transaction) {
  assertMercadoPagoConfigured();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: transaction.userId } });
  const amountFiat = Number(transaction.amountFiat);

  try {
    // O aviso de pagamento chega pelo webhook configurado no painel do
    // Mercado Pago (evento "Order") - a Orders API nao aceita notification_url.
    const order = transaction.providerReference ? await mpOrderClient.get({ id: transaction.providerReference }) : await mpOrderClient.create({
      body: {
        type: 'online',
        processing_mode: 'automatic',
        total_amount: amountFiat.toFixed(2),
        external_reference: transaction.id,
        payer: { email: user.email },
        transactions: {
          payments: [{ amount: amountFiat.toFixed(2), payment_method: { id: 'pix', type: 'bank_transfer' } }],
        },
      },
      requestOptions: { idempotencyKey: transaction.id },
    });

    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { providerReference: order.id ?? null },
    });

    const pixData = order.transactions?.payments?.[0]?.payment_method;

    return {
      transactionId: transaction.id,
      status: order.status ?? 'pending',
      qrCode: pixData?.qr_code ?? null,
      qrCodeBase64: pixData?.qr_code_base64 ?? null,
    };
  } catch (err) {
    // A timeout may happen after the provider created the order. Keep raffle capacity
    // reserved until a terminal provider status; a retry uses the same order/key.
    if (transaction.type !== 'PURCHASE_RAFFLE') {
      await prisma.transaction.updateMany({ where: { id: transaction.id, status: 'PENDING' }, data: { status: 'FAILED' } });
    }
    logger.error('Erro ao criar cobrança Pix no Mercado Pago', { transactionId: transaction.id, err });
    throw new AppError(transaction.type === 'PURCHASE_RAFFLE'
      ? 'Não foi possível obter o Pix. A compra está em Meus bilhetes; use Retomar Pix para recuperar a mesma cobrança.'
      : 'Não foi possível gerar a cobrança Pix no Mercado Pago', 502);
  }
}

export async function getPixChargeStatus(userId: string, transactionId: string) {
  const transaction = await prisma.transaction.findFirst({ where: { id: transactionId, userId } });
  if (!transaction) {
    throw new AppError('Cobrança não encontrada', 404);
  }

  return {
    status: transaction.status,
    amountCredits: transaction.amountCredits,
    amountFiat: transaction.amountFiat.toString(),
  };
}

/**
 * O status confiavel e sempre buscado direto na API do Mercado Pago usando
 * nossas credenciais - o corpo do webhook e tratado apenas como um aviso
 * de "confira a order X", nunca como fonte de verdade sobre valor/status.
 */
export async function handleMercadoPagoWebhook(orderId: string): Promise<void> {
  assertMercadoPagoConfigured();

  const order = await mpOrderClient.get({ id: orderId });
  const transactionId = order.external_reference;
  if (!transactionId || !order.status) {
    return;
  }

  const localTransaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (localTransaction?.type === 'PURCHASE_RAFFLE') {
    if (ORDER_PAID_STATUSES.includes(order.status)) {
      await settleRafflePayment(transactionId, Math.round(Number(order.total_amount) * 100), order.id ?? orderId);
    } else if (ORDER_FAILED_STATUSES.includes(order.status)) {
      await settleRafflePayment(transactionId, null, order.id ?? orderId);
    }
    return;
  }

  if (ORDER_PAID_STATUSES.includes(order.status)) {
    const status = order.status;
    await prisma.$transaction(async (tx) => {
      const pending = await tx.transaction.findFirst({ where: { id: transactionId, status: 'PENDING' } });
      if (!pending) {
        return;
      }

      // So credita se o valor pago no Mercado Pago bate com o valor cobrado
      const paidCents = Math.round(Number(order.total_amount) * 100);
      const expectedCents = Math.round(Number(pending.amountFiat) * 100);
      if (paidCents !== expectedCents) {
        logger.error('Valor pago no Mercado Pago diferente do cobrado - chaves não creditadas', {
          transactionId,
          orderId,
          status,
          paid: order.total_amount,
          expected: pending.amountFiat.toString(),
        });
        return;
      }

      const updated = await tx.transaction.updateMany({
        where: { id: transactionId, status: 'PENDING' },
        data: { status: 'COMPLETED' },
      });

      if (updated.count === 0) {
        return;
      }

      await tx.userCredit.update({
        where: { userId: pending.userId },
        data: { balance: { increment: pending.amountCredits } },
      });
      logger.info('Pagamento Pix confirmado - chaves creditadas', {
        transactionId,
        orderId,
        credits: pending.amountCredits,
      });
    });
  } else if (ORDER_FAILED_STATUSES.includes(order.status)) {
    await prisma.transaction.updateMany({
      where: { id: transactionId, status: 'PENDING' },
      data: { status: 'FAILED' },
    });
  }
}
