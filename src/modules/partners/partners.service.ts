import { Prisma, RafflePurchase } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/errors';
import { commissionCents } from './commission.util';

export async function lockPartner(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM partners WHERE id = ${id}::uuid FOR UPDATE`;
  const partner = await tx.partner.findUnique({ where: { id } });
  if (!partner) throw new AppError('Parceiro não encontrado', 404);
  return partner;
}

export async function referralForSignup(tx: Prisma.TransactionClient, code?: string) {
  if (!code) return null;
  const found = await tx.partner.findUnique({ where: { code } });
  if (!found) throw new AppError('Link de indicação inválido. Remova a indicação para continuar.', 422);
  const partner = await lockPartner(tx, found.id);
  if (!partner.active || partner.blocked) throw new AppError('Link de indicação indisponível. Remova a indicação para continuar.', 422);
  return partner.id;
}

export async function snapshotCommission(tx: Prisma.TransactionClient, userId: string) {
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.affiliateId) return {};
  const partner = await lockPartner(tx, user.affiliateId);
  if (!partner.active || partner.blocked || partner.userId === userId
    || (partner.durationDays !== null && Date.now() >= user.createdAt.getTime() + partner.durationDays * 86400000)) return {};
  return { commissionPartnerId: partner.id, commissionBps: partner.rateBps, commissionHoldDays: partner.holdDays };
}

/** Called only inside the payment transaction. Purchase uniqueness prevents duplicate commissions. */
export async function createCommission(tx: Prisma.TransactionClient, purchase: RafflePurchase) {
  if (!purchase.commissionPartnerId || !purchase.commissionBps) return;
  await lockPartner(tx, purchase.commissionPartnerId);
  const amountCents = commissionCents(purchase.totalCents, purchase.commissionBps);
  const now = new Date();
  await tx.partnerCommission.create({ data: { partnerId: purchase.commissionPartnerId, purchaseId: purchase.id,
    rateBps: purchase.commissionBps, amountCents, availableAt: new Date(now.getTime() + purchase.commissionHoldDays * 86400000) } });
}

/** Caller holds the partner lock. Release is persisted and can run again after any restart. */
export async function releaseDue(tx: Prisma.TransactionClient, partnerId: string) {
  const due = await tx.partnerCommission.findMany({ where: { partnerId, releasedAt: null, availableAt: { lte: new Date() } } });
  const amount = due.reduce((sum, row) => sum + row.amountCents - row.reversedCents, 0);
  if (due.length) {
    await tx.partnerCommission.updateMany({ where: { id: { in: due.map((row) => row.id) } }, data: { releasedAt: new Date() } });
    await tx.partner.update({ where: { id: partnerId }, data: { balanceCents: { increment: amount } } });
  }
}

export async function partnerWallet(userId: string) {
  const found = await prisma.partner.findUnique({ where: { userId } });
  if (!found) return null;
  return prisma.$transaction(async (tx) => {
    await lockPartner(tx, found.id);
    await releaseDue(tx, found.id);
    const partner = await tx.partner.findUniqueOrThrow({ where: { id: found.id } });
    const pending = await tx.partnerCommission.findMany({ where: { partnerId: partner.id, releasedAt: null } });
    const requests = await tx.withdrawal.aggregate({ where: { userId, source: 'COMMISSIONS', status: 'PENDING' }, _sum: { amountFiat: true } });
    const paid = await tx.withdrawal.aggregate({ where: { userId, source: 'COMMISSIONS', status: 'PAID' }, _sum: { amountFiat: true } });
    return { partnerId: partner.id, active: partner.active, blocked: partner.blocked, code: partner.code,
      rateBps: partner.rateBps, holdDays: partner.holdDays, durationDays: partner.durationDays,
      availableCents: Math.max(0, Number(partner.balanceCents)), debtCents: Math.max(0, -Number(partner.balanceCents)),
      pendingCents: pending.reduce((sum, row) => sum + row.amountCents - row.reversedCents, 0),
      reservedCents: Math.round(Number(requests._sum.amountFiat ?? 0) * 100), paidCents: Math.round(Number(paid._sum.amountFiat ?? 0) * 100) };
  });
}

export interface PartnerConfig { rateBps: number; holdDays: number; durationDays: number | null; active: boolean; blocked: boolean; reason: string }
export async function savePartner(adminId: string, config: PartnerConfig, id?: string, userEmail?: string, code?: string) {
  return prisma.$transaction(async (tx) => {
    let partner;
    const { reason, ...data } = config;
    if (id) {
      await lockPartner(tx, id);
      partner = await tx.partner.update({ where: { id }, data });
    } else {
      const user = await tx.user.findUnique({ where: { email: userEmail! } });
      if (!user) throw new AppError('Cadastre primeiro a conta do parceiro com este e-mail', 404);
      if (await tx.partner.findUnique({ where: { userId: user.id } })) throw new AppError('Esta conta já possui um parceiro', 409);
      const ref = code ?? randomBytes(9).toString('hex');
      if (await tx.partner.findUnique({ where: { code: ref } })) throw new AppError('Código de indicação já utilizado', 409);
      partner = await tx.partner.create({ data: { ...data, userId: user.id, code: ref } });
    }
    await tx.partnerAudit.create({ data: { partnerId: partner.id, adminId, action: id ? 'CONFIG_UPDATED' : 'CREATED', details: { ...config } } });
    return partner;
  });
}

export async function listPartners() {
  const partners = await prisma.partner.findMany({ orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true, email: true } }, _count: { select: { referrals: true } } } });
  return Promise.all(partners.map(async (partner) => ({ ...partner, wallet: await partnerWallet(partner.userId) })));
}

/** Administrative accounting of a refund performed outside the application; does not send money. */
export async function recordRefund(adminId: string, purchaseId: string, totalRefundedCents: number, reference: string) {
  return prisma.$transaction(async (tx) => {
    const initial = await tx.rafflePurchase.findUnique({ where: { id: purchaseId } });
    if (!initial) throw new AppError('Compra não encontrada', 404);
    await tx.$queryRaw`SELECT id FROM raffles WHERE id = ${initial.raffleId}::uuid FOR UPDATE`;
    const purchase = await tx.rafflePurchase.findUniqueOrThrow({ where: { id: purchaseId } });
    if (purchase.status !== 'PAID' || totalRefundedCents > purchase.totalCents || totalRefundedCents < purchase.refundedCents) throw new AppError('Informe um total acumulado de estornos válido para uma compra paga', 409);
    if (totalRefundedCents === purchase.refundedCents) return purchase;
    const found = await tx.partnerCommission.findUnique({ where: { purchaseId } });
    if (!found) throw new AppError('Esta compra não possui comissão de parceiro', 409);
    await lockPartner(tx, found.partnerId);
    const commission = await tx.partnerCommission.findUniqueOrThrow({ where: { purchaseId } });
    const reversedCents = commission.amountCents - commissionCents(purchase.totalCents - totalRefundedCents, commission.rateBps);
    if (commission.releasedAt) await tx.partner.update({ where: { id: commission.partnerId }, data: { balanceCents: { decrement: reversedCents - commission.reversedCents } } });
    await tx.partnerCommission.update({ where: { id: commission.id }, data: { reversedCents } });
    const updated = await tx.rafflePurchase.update({ where: { id: purchaseId }, data: { refundedCents: totalRefundedCents } });
    await tx.partnerAudit.create({ data: { partnerId: commission.partnerId, adminId, action: 'REFUND_RECORDED', details: { purchaseId, totalRefundedCents, reversedCents, reference } } });
    return updated;
  });
}

export interface DashboardQuery { page: number; from?: Date; to?: Date; raffleId?: string }
export async function partnerDashboard(partnerId: string, query: DashboardQuery, admin = false) {
  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
  if (!partner) throw new AppError('Parceiro não encontrado', 404);
  const where: Prisma.PartnerCommissionWhereInput = { partnerId, createdAt: { gte: query.from, lte: query.to },
    ...(query.raffleId ? { purchase: { raffleId: query.raffleId } } : {}) };
  const wallet = await partnerWallet(partner.userId);
  const [referred, total, rows, matching, audits] = await Promise.all([
    prisma.user.findMany({ where: { affiliateId: partnerId, createdAt: { gte: query.from, lte: query.to } },
      select: { nickname: true, playerNumber: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.partnerCommission.count({ where }),
    prisma.partnerCommission.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 50, skip: (query.page - 1) * 50,
      include: { purchase: { select: { userId: true, quantity: true, totalCents: true, refundedCents: true,
        user: { select: { nickname: true, playerNumber: true } }, raffle: { select: { id: true, title: true } } } } } }),
    prisma.partnerCommission.findMany({ where, select: { amountCents: true, reversedCents: true, releasedAt: true,
      purchase: { select: { userId: true, quantity: true, totalCents: true, refundedCents: true } } } }),
    admin ? prisma.partnerAudit.findMany({ where: { partnerId }, orderBy: { createdAt: 'desc' }, take: 50 }) : Promise.resolve([]),
  ]);
  const totals = matching.reduce((sum, c) => ({ tickets: sum.tickets + c.purchase.quantity, salesCents: sum.salesCents + c.purchase.totalCents,
    refundedCents: sum.refundedCents + c.purchase.refundedCents, commissionCents: sum.commissionCents + c.amountCents,
    reversedCents: sum.reversedCents + c.reversedCents }), { tickets: 0, salesCents: 0, refundedCents: 0, commissionCents: 0, reversedCents: 0 });
  return { wallet, totals: { ...totals, buyers: new Set(matching.map((c) => c.purchase.userId)).size,
    referrals: await prisma.user.count({ where: { affiliateId: partnerId, createdAt: { gte: query.from, lte: query.to } } }) },
    referred, rows, total, page: query.page, audits };
}

/** Same-CPF withdrawals are a review signal; an IP match alone never blocks a family. */
export async function assertCommissionWithdrawal(tx: Prisma.TransactionClient, userId: string, cpf?: string) {
  const partner = await tx.partner.findUnique({ where: { userId } });
  if (!partner) throw new AppError('Conta sem carteira de comissões', 404);
  await lockPartner(tx, partner.id);
  if (partner.blocked) throw new AppError('Saques de comissões bloqueados para revisão administrativa', 409);
  if (cpf && await tx.withdrawal.findFirst({ where: { cpf, userId: { not: userId }, user: { affiliateId: partner.id } } })) {
    throw new AppError('CPF também utilizado por um indicado. O saque exige revisão administrativa.', 409);
  }
  await releaseDue(tx, partner.id);
  return tx.partner.findUniqueOrThrow({ where: { id: partner.id } });
}
