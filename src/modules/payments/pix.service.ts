import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { AppError } from '../../utils/errors';
import { mpOrderClient } from './mercadopago.client';

// Status de order (Orders API) que encerram a cobranca.
const ORDER_PAID_STATUSES = ['processed'];
const ORDER_FAILED_STATUSES = ['failed', 'canceled', 'expired'];

function assertMercadoPagoConfigured(): void {
  if (!env.mercadoPagoAccessToken) {
    throw new AppError('Integracao com Mercado Pago nao configurada (MERCADOPAGO_ACCESS_TOKEN ausente)', 503);
  }
}

export async function createPixCharge(userId: string, creditsAmount: number) {
  assertMercadoPagoConfigured();

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
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

  try {
    // O aviso de pagamento chega pelo webhook configurado no painel do
    // Mercado Pago (evento "Order") - a Orders API nao aceita notification_url.
    const order = await mpOrderClient.create({
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
    await prisma.transaction.update({ where: { id: transaction.id }, data: { status: 'FAILED' } });
    console.error('Erro ao criar cobranca Pix no Mercado Pago', err);
    throw new AppError('Nao foi possivel gerar a cobranca Pix no Mercado Pago', 502);
  }
}

export async function getPixChargeStatus(userId: string, transactionId: string) {
  const transaction = await prisma.transaction.findFirst({ where: { id: transactionId, userId } });
  if (!transaction) {
    throw new AppError('Cobranca nao encontrada', 404);
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

  if (ORDER_PAID_STATUSES.includes(order.status)) {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.transaction.updateMany({
        where: { id: transactionId, status: 'PENDING' },
        data: { status: 'COMPLETED' },
      });

      if (updated.count === 0) {
        return;
      }

      const transaction = await tx.transaction.findUniqueOrThrow({ where: { id: transactionId } });
      await tx.userCredit.update({
        where: { userId: transaction.userId },
        data: { balance: { increment: transaction.amountCredits } },
      });
    });
  } else if (ORDER_FAILED_STATUSES.includes(order.status)) {
    await prisma.transaction.updateMany({
      where: { id: transactionId, status: 'PENDING' },
      data: { status: 'FAILED' },
    });
  }
}
