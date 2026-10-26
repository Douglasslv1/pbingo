import { Prisma, Raffle } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/errors';
import { env } from '../../config/env';
import { createPixForTransaction } from '../payments/pix.service';
import { Discount, quoteRaffle, RaffleInput } from './raffles.schemas';
import { sampleAvailableNumbers } from './raffleNumbers';
import { createCommission, snapshotCommission } from '../partners/partners.service';

export async function lockRaffle(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM raffles WHERE id = ${id}::uuid FOR UPDATE`;
  const raffle = await tx.raffle.findUnique({ where: { id } });
  if (!raffle) throw new AppError('Rifa não encontrada', 404);
  return raffle;
}

function view(raffle: Raffle) {
  return { ...raffle, discounts: raffle.discounts as Discount[], totalTickets: 10 ** raffle.digits,
    rule: `Últimos ${raffle.digits} dígitos do ${raffle.prizePosition}º prêmio. Número não vendido: edição sem ganhador.`,
    salesOpen: raffle.status === 'OPEN' && raffle.closesAt > new Date() };
}

export async function listRaffles(admin = false) {
  const raffles = await prisma.raffle.findMany({
    where: admin ? {} : { status: { not: 'DRAFT' } }, orderBy: [{ drawAt: 'desc' }, { id: 'desc' }],
  });
  return Promise.all(raffles.map(async (raffle) => {
    const groups = await prisma.rafflePurchase.groupBy({ by: ['status'], where: { raffleId: raffle.id },
      _sum: { quantity: true, totalCents: true, refundedCents: true }, _count: { _all: true } });
    const paid = groups.find((g) => g.status === 'PAID');
    const pending = groups.find((g) => g.status === 'PENDING');
    const sold = paid?._sum.quantity ?? 0;
    const reserved = pending?._sum.quantity ?? 0;
    const winner = raffle.drawnNumber === null ? null : await prisma.raffleTicket.findUnique({
      where: { raffleId_number: { raffleId: raffle.id, number: raffle.drawnNumber } },
      select: { purchase: { select: { id: true, user: { select: { id: true, name: true, email: true, nickname: true, playerNumber: true } } } } },
    });
    return { ...view(raffle), resultRecordedBy: admin ? raffle.resultRecordedBy : undefined,
      sold, reserved, available: 10 ** raffle.digits - sold - reserved,
      ...(admin ? { revenueCents: (paid?._sum.totalCents ?? 0) - (paid?._sum.refundedCents ?? 0), pendingCents: pending?._sum.totalCents ?? 0,
        buyers: await prisma.rafflePurchase.findMany({ where: { raffleId: raffle.id, status: 'PAID' }, distinct: ['userId'], select: { userId: true } }).then((r) => r.length) } : {}),
      winner: winner ? { name: admin ? winner.purchase.user.name : winner.purchase.user.nickname ?? `Jogador #${winner.purchase.user.playerNumber}`,
        ...(admin ? { email: winner.purchase.user.email, userId: winner.purchase.user.id, purchaseId: winner.purchase.id } : {}) } : null,
    };
  }));
}

export async function saveRaffle(input: RaffleInput, id?: string) {
  const data = { ...input, discounts: input.discounts as unknown as Prisma.InputJsonValue };
  if (!id) return prisma.raffle.create({ data });
  return prisma.$transaction(async (tx) => {
    const raffle = await lockRaffle(tx, id);
    if (raffle.status !== 'DRAFT') throw new AppError('Somente rascunhos podem ser editados. Crie outra edição para mudar as regras.', 409);
    return tx.raffle.update({ where: { id }, data });
  });
}

export async function setRaffleStatus(id: string, action: 'publish' | 'close') {
  return prisma.$transaction(async (tx) => {
    const raffle = await lockRaffle(tx, id);
    if (action === 'publish') {
      if (raffle.status !== 'DRAFT' || raffle.closesAt <= new Date()) throw new AppError('Publique um rascunho com encerramento no futuro', 409);
    } else if (raffle.status !== 'OPEN') throw new AppError('A rifa não está aberta', 409);
    return tx.raffle.update({ where: { id }, data: { status: action === 'publish' ? 'OPEN' : 'CLOSED' } });
  });
}

export async function purchaseRaffle(userId: string, raffleId: string, quantity: number) {
  if (!env.mercadoPagoAccessToken) throw new AppError('Integração com Mercado Pago não configurada', 503);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) throw new AppError('Escolha entre 1 e 1000 bilhetes');
  const transaction = await prisma.$transaction(async (tx) => {
    const raffle = await lockRaffle(tx, raffleId);
    if (raffle.status !== 'OPEN' || raffle.closesAt <= new Date()) throw new AppError('As vendas desta rifa estão encerradas', 409);
    const reserved = await tx.rafflePurchase.aggregate({ where: { raffleId, status: { in: ['PENDING', 'PAID'] } }, _sum: { quantity: true } });
    if ((reserved._sum.quantity ?? 0) + quantity > 10 ** raffle.digits) throw new AppError('Quantidade de bilhetes indisponível', 409);
    const quote = quoteRaffle(raffle.priceCents, raffle.discounts as Discount[], quantity);
    const commission = await snapshotCommission(tx, userId);
    if (quote.totalCents < 100 || quote.totalCents > 999999999) throw new AppError('O total da compra deve ficar entre R$ 1,00 e R$ 9.999.999,99');
    return tx.transaction.create({ data: {
      userId, type: 'PURCHASE_RAFFLE', game: 'RAFFLE', amountFiat: new Prisma.Decimal(quote.totalCents).div(100), status: 'PENDING',
      rafflePurchase: { create: { ...commission, raffleId, userId, quantity, unitPriceCents: quote.unitPriceCents,
        discountPercent: quote.discountPercent, totalCents: quote.totalCents } },
    } });
  });
  return createPixForTransaction(transaction);
}

/** Lock order is always raffle, then transaction: purchases, callbacks and draw serialize together. */
export async function settleRafflePayment(transactionId: string, paidCents: number | null, providerId: string) {
  return prisma.$transaction(async (tx) => {
    const purchase = await tx.rafflePurchase.findUnique({ where: { transactionId } });
    if (!purchase) throw new AppError('Compra da rifa não encontrada', 404);
    const raffle = await lockRaffle(tx, purchase.raffleId);
    const transaction = await tx.transaction.findUniqueOrThrow({ where: { id: transactionId } });
    if (transaction.status !== 'PENDING') return;
    if (transaction.providerReference && transaction.providerReference !== providerId) throw new AppError('Cobrança não corresponde à compra', 409);
    if (paidCents !== null && paidCents !== purchase.totalCents) throw new AppError('Valor pago diferente do valor da compra', 409);
    if (paidCents !== null && raffle.status === 'DRAWN') throw new AppError('Rifa já apurada; pagamento exige revisão', 409);
    await tx.transaction.update({ where: { id: transactionId }, data: { status: paidCents === null ? 'FAILED' : 'COMPLETED', providerReference: providerId } });
    await tx.rafflePurchase.update({ where: { id: purchase.id }, data: { status: paidCents === null ? 'FAILED' : 'PAID', paidAt: paidCents === null ? null : new Date() } });
    if (paidCents !== null) {
      // The raffle lock covers reading sold numbers, sampling and insertion, including retries.
      const sold = await tx.raffleTicket.findMany({ where: { raffleId: raffle.id }, select: { number: true } });
      const totalTickets = 10 ** raffle.digits;
      if (sold.length + purchase.quantity > totalTickets) throw new AppError('Capacidade da rifa excedida', 409);
      const numbers = sampleAvailableNumbers(totalTickets, sold.map((ticket) => ticket.number), purchase.quantity);
      await tx.raffleTicket.createMany({ data: numbers.map((number) => ({ raffleId: raffle.id, purchaseId: purchase.id, number })) });
      await createCommission(tx, purchase);
    }
  });
}

export async function myRafflePurchases(userId: string) {
  return prisma.rafflePurchase.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100,
    include: { raffle: { select: { title: true, digits: true, drawAt: true, status: true, drawnNumber: true } },
      tickets: { select: { number: true }, orderBy: { number: 'asc' } } } });
}

export async function raffleBuyers(raffleId: string, page: number) {
  const where = { raffleId };
  const [items, total] = await Promise.all([
    prisma.rafflePurchase.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 50, skip: (page - 1) * 50,
      include: { user: { select: { id: true, name: true, email: true } }, tickets: { select: { number: true }, orderBy: { number: 'asc' } } } }),
    prisma.rafflePurchase.count({ where }),
  ]);
  return { items, total, page };
}

export async function drawRaffle(id: string, adminId: string, resultNumber: string, resultSource: string) {
  return prisma.$transaction(async (tx) => {
    const raffle = await lockRaffle(tx, id);
    if (!['OPEN', 'CLOSED'].includes(raffle.status) || raffle.drawAt > new Date() || raffle.closesAt > new Date()) {
      throw new AppError('A apuração só pode ocorrer após o encerramento das vendas e o horário do sorteio', 409);
    }
    if (await tx.rafflePurchase.count({ where: { raffleId: id, status: 'PENDING' } })) {
      throw new AppError('Existem pagamentos pendentes. Confira as cobranças antes de apurar.', 409);
    }
    if (resultNumber.length < raffle.digits) throw new AppError('O número informado tem menos dígitos que a regra da rifa');
    const drawnNumber = Number(resultNumber.slice(-raffle.digits));
    await tx.raffle.update({ where: { id }, data: { status: 'DRAWN', drawnNumber, resultNumber, resultSource,
      resultRecordedBy: adminId, drawnAt: new Date() } });
    const ticket = await tx.raffleTicket.findUnique({ where: { raffleId_number: { raffleId: id, number: drawnNumber } } });
    return { drawnNumber, winningPurchaseId: ticket?.purchaseId ?? null };
  });
}
