import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { AppError } from '../../utils/errors';
import { mpPaymentClient } from './mercadopago.client';

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
    const payment = await mpPaymentClient.create({
      body: {
        transaction_amount: amountFiat,
        description: `Compra de ${creditsAmount} chave(s) - Bingo Online`,
        payment_method_id: 'pix',
        payer: { email: user.email },
        external_reference: transaction.id,
        notification_url: `${env.publicBaseUrl}/payments/webhook/mercadopago`,
      },
    });

    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { providerReference: payment.id ? String(payment.id) : null },
    });

    const qrData = payment.point_of_interaction?.transaction_data;

    return {
      transactionId: transaction.id,
      status: payment.status ?? 'pending',
      qrCode: qrData?.qr_code ?? null,
      qrCodeBase64: qrData?.qr_code_base64 ?? null,
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
 * de "confira o pagamento X", nunca como fonte de verdade sobre valor/status.
 */
export async function handleMercadoPagoWebhook(paymentId: string): Promise<void> {
  assertMercadoPagoConfigured();

  const payment = await mpPaymentClient.get({ id: paymentId });
  const transactionId = payment.external_reference;
  if (!transactionId) {
    return;
  }

  if (payment.status === 'approved') {
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
  } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
    await prisma.transaction.updateMany({
      where: { id: transactionId, status: 'PENDING' },
      data: { status: 'FAILED' },
    });
  }
}
