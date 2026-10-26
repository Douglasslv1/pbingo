import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { env } from '../src/config/env';
import { mpOrderClient } from '../src/modules/payments/mercadopago.client';
import { partnerDashboard, partnerWallet, recordRefund, savePartner } from '../src/modules/partners/partners.service';
import { purchaseRaffle, settleRafflePayment } from '../src/modules/raffles/raffles.service';
import { markWithdrawalPaid, rejectWithdrawal, requestWithdrawal } from '../src/modules/withdrawals/withdrawals.service';
import { makeAdmin, registerTestUser, setPrizeBalance } from './helpers';
import { app } from './testApp';

const originalToken = env.mercadoPagoAccessToken;
let counter = 0;
const settings = { rateBps: 500, holdDays: 0, durationDays: null, active: true, blocked: false, reason: 'Configuração inicial de teste' };
const auth = (token: string) => `Bearer ${token}`;
beforeEach(() => {
  env.mercadoPagoAccessToken = 'APP_USR-test';
  vi.spyOn(mpOrderClient, 'create').mockImplementation(async (params) => ({ id: `ORD-${params.body.external_reference}`, status: 'pending' } as never));
});
afterEach(() => { env.mercadoPagoAccessToken = originalToken; vi.restoreAllMocks(); });

async function fixture(overrides = {}) {
  const admin = await registerTestUser(); await makeAdmin(admin.user.id);
  const owner = await registerTestUser();
  const partner = await savePartner(admin.user.id, { ...settings, ...overrides }, undefined, owner.user.email, 'parceiro-teste');
  counter++;
  const signup = await request(app).post('/auth/register').send({ name: 'Indicado', email: `indicado-${counter}@example.com`, password: 'senha1234',
    birthDate: '1990-05-20', acceptTerms: true, referralCode: partner.code });
  expect(signup.status).toBe(201);
  const buyer = { token: signup.body.token as string, user: signup.body.user as { id: string; email: string } };
  const raffle = await prisma.raffle.create({ data: { title: 'Rifa de teste', description: 'Prêmio', image: 'https://example.com/image.png', prize: 'Bicicleta',
    priceCents: 500, discounts: [{ minQuantity: 10, percent: 10 }], digits: 3, lottery: 'Federal', contest: '1234', prizePosition: 1,
    closesAt: new Date(Date.now() + 3600000), drawAt: new Date(Date.now() + 7200000), status: 'OPEN' } });
  return { admin, owner, partner, buyer, raffle };
}
async function purchase(f: Awaited<ReturnType<typeof fixture>>, quantity = 10) {
  const charge = await purchaseRaffle(f.buyer.user.id, f.raffle.id, quantity);
  const tx = await prisma.transaction.findUniqueOrThrow({ where: { id: charge.transactionId } });
  return { id: tx.id, cents: Math.round(Number(tx.amountFiat) * 100), provider: tx.providerReference! };
}
async function pay(order: { id: string; cents: number; provider: string }) { await settleRafflePayment(order.id, order.cents, order.provider); }
const withdrawal = (amount: number) => ({ amount, source: 'COMMISSIONS' as const, cpf: '52998224725', pixKeyType: 'EMAIL' as const, pixKey: 'partner@example.com' });

describe('Parceiros: vínculo e permissões', () => {
  it('vincula somente no cadastro e o banco impede trocar ou adicionar parceiro depois', async () => {
    const f = await fixture();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: f.buyer.user.id } })).affiliateId).toBe(f.partner.id);
    await expect(prisma.user.update({ where: { id: f.buyer.user.id }, data: { affiliateId: null } })).rejects.toThrow();
    await expect(prisma.user.update({ where: { id: f.owner.user.id }, data: { affiliateId: f.partner.id } })).rejects.toThrow();
    const duplicate = await request(app).post('/auth/register').send({ name: 'Parceiro', email: f.owner.user.email, password: 'senha1234', birthDate: '1990-05-20', acceptTerms: true, referralCode: f.partner.code });
    expect(duplicate.status).toBe(409);
  });
  it('recusa códigos inexistentes, pausados e bloqueados e não concede acesso ao admin', async () => {
    const f = await fixture();
    const payload = { name: 'Pessoa', email: 'linkinvalido@example.com', password: 'senha1234', birthDate: '1990-05-20', acceptTerms: true, referralCode: 'inexistente' };
    expect((await request(app).post('/auth/register').send(payload)).status).toBe(422);
    await savePartner(f.admin.user.id, { ...settings, active: false }, f.partner.id);
    expect((await request(app).post('/auth/register').send({ ...payload, referralCode: f.partner.code })).status).toBe(422);
    expect((await request(app).get('/admin/partners').set('Authorization', auth(f.owner.token))).status).toBe(403);
    expect((await request(app).get('/partners/me').set('Authorization', auth(f.buyer.token))).status).toBe(404);
    expect((await request(app).get('/partners/me').set('Authorization', auth(f.owner.token))).status).toBe(200);
  });
  it('exige configuração completa antes de cadastrar o parceiro', async () => {
    const admin = await registerTestUser(); await makeAdmin(admin.user.id);
    expect((await request(app).post('/admin/partners').set('Authorization', auth(admin.token)).send({ userEmail: admin.user.email, active: true })).status).toBe(422);
  });
});

describe('Parceiros: geração e liberação de comissões', () => {
  it('gera sobre o valor após desconto apenas no Pix pago, sem duplicar em notificações repetidas', async () => {
    const f = await fixture(); const order = await purchase(f);
    expect(await prisma.partnerCommission.count()).toBe(0);
    await pay(order); await pay(order);
    expect(await prisma.partnerCommission.count()).toBe(1);
    const wallet = await partnerWallet(f.owner.user.id);
    expect(wallet?.availableCents).toBe(225); expect(wallet?.pendingCents).toBe(0);
  });
  it('preserva percentual e prazo da compra mesmo se o admin alterar regras antes do pagamento', async () => {
    const f = await fixture({ holdDays: 2 }); const order = await purchase(f);
    await savePartner(f.admin.user.id, { ...settings, rateBps: 1000 }, f.partner.id);
    await pay(order);
    const row = await prisma.partnerCommission.findFirstOrThrow();
    expect(row.amountCents).toBe(225); expect(row.rateBps).toBe(500);
    expect((await partnerWallet(f.owner.user.id))?.pendingCents).toBe(225);
    expect((await partnerWallet(f.owner.user.id))?.availableCents).toBe(0);
    await prisma.partnerCommission.update({ where: { id: row.id }, data: { availableAt: new Date(Date.now() - 1000) } });
    await Promise.all([partnerWallet(f.owner.user.id), partnerWallet(f.owner.user.id)]);
    expect(Number((await prisma.partner.findUniqueOrThrow({ where: { id: f.partner.id } })).balanceCents)).toBe(225);
  });
  it('não gera para cadastro sem vínculo, compra fora do prazo ou parceria pausada', async () => {
    const f = await fixture({ durationDays: 1 });
    await prisma.user.update({ where: { id: f.buyer.user.id }, data: { createdAt: new Date(Date.now() - 2 * 86400000) } });
    await pay(await purchase(f));
    await savePartner(f.admin.user.id, { ...settings, active: false }, f.partner.id);
    await pay(await purchase(f));
    const other = await registerTestUser(); const charge = await purchaseRaffle(other.user.id, f.raffle.id, 1);
    await settleRafflePayment(charge.transactionId, 500, `ORD-${charge.transactionId}`);
    expect(await prisma.partnerCommission.count()).toBe(0);
  });
  it('dashboard apresenta vendas e indicados sem divulgar e-mail ou CPF do comprador', async () => {
    const f = await fixture(); await pay(await purchase(f));
    const dashboard = await partnerDashboard(f.partner.id, { page: 1 });
    expect(dashboard.totals).toMatchObject({ tickets: 10, salesCents: 4500, commissionCents: 225, referrals: 1, buyers: 1 });
    expect(JSON.stringify(dashboard)).not.toContain(f.buyer.user.email);
    expect((await partnerDashboard(f.partner.id, { page: 1, from: new Date('2040-01-01') })).total).toBe(0);
  });
});

describe('Parceiros: estornos, saques e prevenção de abuso', () => {
  it('reverte estornos parciais e totais uma única vez sem consumir prêmios', async () => {
    const f = await fixture(); await setPrizeBalance(f.owner.user.id, 77); await pay(await purchase(f));
    const commission = await prisma.partnerCommission.findFirstOrThrow();
    await partnerWallet(f.owner.user.id);
    await recordRefund(f.admin.user.id, commission.purchaseId, 1000, 'Estorno parcial no provedor');
    expect((await partnerWallet(f.owner.user.id))?.availableCents).toBe(175);
    await recordRefund(f.admin.user.id, commission.purchaseId, 4500, 'Estorno integral no provedor');
    await recordRefund(f.admin.user.id, commission.purchaseId, 4500, 'Notificação repetida');
    expect((await partnerWallet(f.owner.user.id))?.availableCents).toBe(0);
    expect(Number((await prisma.userPrize.findUniqueOrThrow({ where: { userId: f.owner.user.id } })).balanceFiat)).toBe(77);
    expect(await prisma.partnerAudit.count({ where: { action: 'REFUND_RECORDED' } })).toBe(2);
    await expect(recordRefund(f.admin.user.id, commission.purchaseId, 1000, 'Não pode reduzir estorno')).rejects.toThrow();
  });
  it('estorno antes da liberação reduz somente a comissão pendente', async () => {
    const f = await fixture({ holdDays: 3 }); await pay(await purchase(f));
    const commission = await prisma.partnerCommission.findFirstOrThrow();
    await recordRefund(f.admin.user.id, commission.purchaseId, 1000, 'Devolução confirmada no provedor');
    const wallet = await partnerWallet(f.owner.user.id);
    expect(wallet?.pendingCents).toBe(175); expect(wallet?.availableCents).toBe(0); expect(wallet?.debtCents).toBe(0);
  });
  it('reserva o saque, impede gasto duplicado e reverte a reserva quando recusado', async () => {
    const f = await fixture(); await pay(await purchase(f, 100));
    const result = await requestWithdrawal(f.owner.user.id, withdrawal(20));
    expect((await partnerWallet(f.owner.user.id))?.reservedCents).toBe(2000);
    await expect(requestWithdrawal(f.owner.user.id, withdrawal(20))).rejects.toThrow('insuficiente');
    await rejectWithdrawal(result.withdrawalId, f.admin.user.id, 'Dados bancários devem ser revisados');
    expect((await partnerWallet(f.owner.user.id))?.availableCents).toBe(2250);
  });
  it('impede pagar saque após estorno e compensa a reserva sem afetar prêmios', async () => {
    const f = await fixture(); await pay(await purchase(f, 100)); await setPrizeBalance(f.owner.user.id, 77);
    const result = await requestWithdrawal(f.owner.user.id, withdrawal(20));
    const commission = await prisma.partnerCommission.findFirstOrThrow();
    await recordRefund(f.admin.user.id, commission.purchaseId, 45000, 'Devolução integral confirmada');
    expect((await partnerWallet(f.owner.user.id))?.debtCents).toBe(2000);
    await expect(markWithdrawalPaid(result.withdrawalId, f.admin.user.id, 'comprovante')).rejects.toThrow('estornos');
    await rejectWithdrawal(result.withdrawalId, f.admin.user.id, 'Compra original foi devolvida');
    expect((await partnerWallet(f.owner.user.id))?.debtCents).toBe(0);
    expect(Number((await prisma.userPrize.findUniqueOrThrow({ where: { userId: f.owner.user.id } })).balanceFiat)).toBe(77);
  });
  it('registra pagamento manual uma vez e mantém dívida para compensar após estorno de comissão paga', async () => {
    const f = await fixture(); await pay(await purchase(f, 100));
    const result = await requestWithdrawal(f.owner.user.id, withdrawal(20));
    await markWithdrawalPaid(result.withdrawalId, f.admin.user.id, 'comprovante-pix-123');
    expect((await partnerWallet(f.owner.user.id))?.paidCents).toBe(2000);
    await expect(markWithdrawalPaid(result.withdrawalId, f.admin.user.id, 'repetido')).rejects.toThrow('revisado');
    const commission = await prisma.partnerCommission.findFirstOrThrow();
    await recordRefund(f.admin.user.id, commission.purchaseId, 45000, 'Devolução depois do pagamento');
    expect((await partnerWallet(f.owner.user.id))?.debtCents).toBe(2000);
    await pay(await purchase(f, 100));
    expect((await partnerWallet(f.owner.user.id))?.availableCents).toBe(250);
  });
  it('bloqueia saques de comissões em revisão e sinaliza CPF usado por indicado', async () => {
    const f = await fixture(); await pay(await purchase(f, 100));
    await savePartner(f.admin.user.id, { ...settings, blocked: true }, f.partner.id);
    await expect(requestWithdrawal(f.owner.user.id, withdrawal(10))).rejects.toThrow('bloqueados');
    await savePartner(f.admin.user.id, settings, f.partner.id);
    await setPrizeBalance(f.buyer.user.id, 50);
    await requestWithdrawal(f.buyer.user.id, { ...withdrawal(10), source: 'PRIZES' });
    await expect(requestWithdrawal(f.owner.user.id, withdrawal(10))).rejects.toThrow('CPF');
  });
});
