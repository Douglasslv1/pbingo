import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../src/config/env';
import { prisma } from '../src/lib/prisma';
import { mpOrderClient } from '../src/modules/payments/mercadopago.client';
import { handleMercadoPagoWebhook } from '../src/modules/payments/pix.service';
import { registerTestUser } from './helpers';

const originalToken = env.mercadoPagoAccessToken;

function mockOrder(order: { status: string; total_amount: string; external_reference: string }) {
  return vi.spyOn(mpOrderClient, 'get').mockResolvedValue({ id: 'ORD123', ...order } as never);
}

async function pendingPurchase(credits: number, amountFiat: number) {
  const { user } = await registerTestUser();
  const transaction = await prisma.transaction.create({
    data: { userId: user.id, type: 'PURCHASE_CREDITS', amountCredits: credits, amountFiat, status: 'PENDING' },
  });
  return { user, transaction };
}

async function creditBalance(userId: string) {
  return (await prisma.userCredit.findUnique({ where: { userId } }))?.balance;
}

beforeEach(() => {
  env.mercadoPagoAccessToken = 'APP_USR-teste';
});

afterEach(() => {
  env.mercadoPagoAccessToken = originalToken;
  vi.restoreAllMocks();
});

describe('Webhook do Mercado Pago (Pix)', () => {
  it('credita as chaves uma unica vez mesmo com avisos repetidos', async () => {
    const { user, transaction } = await pendingPurchase(10, 10);
    mockOrder({ status: 'processed', total_amount: '10.00', external_reference: transaction.id });

    await handleMercadoPagoWebhook('ORD123');
    await handleMercadoPagoWebhook('ORD123');

    expect(await creditBalance(user.id)).toBe(10);
    const updated = await prisma.transaction.findUnique({ where: { id: transaction.id } });
    expect(updated?.status).toBe('COMPLETED');
  });

  it('nao credita quando o valor pago difere do cobrado', async () => {
    const { user, transaction } = await pendingPurchase(10, 10);
    mockOrder({ status: 'processed', total_amount: '0.10', external_reference: transaction.id });

    await handleMercadoPagoWebhook('ORD123');

    expect(await creditBalance(user.id)).toBe(0);
    const unchanged = await prisma.transaction.findUnique({ where: { id: transaction.id } });
    expect(unchanged?.status).toBe('PENDING');
  });

  it('marca a cobranca como falha quando a order expira ou e cancelada', async () => {
    const { user, transaction } = await pendingPurchase(5, 5);
    mockOrder({ status: 'expired', total_amount: '5.00', external_reference: transaction.id });

    await handleMercadoPagoWebhook('ORD123');

    expect(await creditBalance(user.id)).toBe(0);
    const failed = await prisma.transaction.findUnique({ where: { id: transaction.id } });
    expect(failed?.status).toBe('FAILED');
  });

  it('ignora order que ainda nao foi paga', async () => {
    const { user, transaction } = await pendingPurchase(5, 5);
    mockOrder({ status: 'action_required', total_amount: '5.00', external_reference: transaction.id });

    await handleMercadoPagoWebhook('ORD123');

    expect(await creditBalance(user.id)).toBe(0);
    const pending = await prisma.transaction.findUnique({ where: { id: transaction.id } });
    expect(pending?.status).toBe('PENDING');
  });
});
