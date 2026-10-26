import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../src/config/env';
import { prisma } from '../src/lib/prisma';
import { mpOrderClient } from '../src/modules/payments/mercadopago.client';
import { handleMercadoPagoWebhook } from '../src/modules/payments/pix.service';
import { quoteRaffle, raffleSchema, resultSchema } from '../src/modules/raffles/raffles.schemas';
import { drawRaffle, settleRafflePayment } from '../src/modules/raffles/raffles.service';
import { makeAdmin, registerTestUser } from './helpers';
import { app } from './testApp';

const originalToken = env.mercadoPagoAccessToken;
const input = () => ({ title: 'Rifa da semana', description: 'Prêmio da semana para o vencedor.',
  image: 'https://example.com/premio.png', prize: 'Uma bicicleta', priceCents: 500,
  discounts: [{ minQuantity: 10, percent: 10 }, { minQuantity: 20, percent: 20 }],
  digits: 2, lottery: 'Loteria Federal', contest: '1234', prizePosition: 1,
  closesAt: new Date(Date.now() + 3600000).toISOString(), drawAt: new Date(Date.now() + 7200000).toISOString() });
const bearer = (token: string) => `Bearer ${token}`;

beforeEach(() => {
  env.mercadoPagoAccessToken = 'APP_USR-teste';
  vi.spyOn(mpOrderClient, 'create').mockImplementation(async (params) => ({
    id: `ORD-${params.body.external_reference}`, status: 'pending',
    transactions: { payments: [{ payment_method: { qr_code: 'pix-code', qr_code_base64: 'image' } }] },
  } as never));
});
afterEach(() => { env.mercadoPagoAccessToken = originalToken; vi.restoreAllMocks(); });

async function published(overrides = {}) {
  return prisma.raffle.create({ data: { ...raffleSchema.parse({ ...input(), ...overrides }), status: 'OPEN' } });
}
async function buy(token: string, id: string, quantity: number) {
  return request(app).post(`/raffles/${id}/purchases`).set('Authorization', bearer(token)).send({ quantity });
}

describe('Rifas: preços, acesso e cadastro', () => {
  it('aplica a maior faixa a toda a compra e arredonda apenas o total em centavos', () => {
    expect(quoteRaffle(500, input().discounts, 9)).toMatchObject({ totalCents: 4500, discountPercent: 0 });
    expect(quoteRaffle(500, input().discounts, 10)).toMatchObject({ totalCents: 4500, discountPercent: 10 });
    expect(quoteRaffle(500, input().discounts, 20)).toMatchObject({ totalCents: 8000, discountPercent: 20 });
    expect(quoteRaffle(199, input().discounts, 11).totalCents).toBe(1970);
  });
  it('valida faixas crescentes e origem oficial do resultado', () => {
    expect(raffleSchema.safeParse({ ...input(), discounts: [{ minQuantity: 10, percent: 20 }, { minQuantity: 20, percent: 10 }] }).success).toBe(false);
    expect(resultSchema.safeParse({ resultNumber: '12345', resultSource: 'https://caixa.gov.br.evil.com' }).success).toBe(false);
    expect(resultSchema.safeParse({ resultNumber: '12345', resultSource: 'https://loterias.caixa.gov.br/Paginas/Federal.aspx' }).success).toBe(true);
  });
  it('somente admin cadastra, edita e publica; regras publicadas ficam imutáveis', async () => {
    const player = await registerTestUser();
    expect((await request(app).post('/admin/raffles').set('Authorization', bearer(player.token)).send(input())).status).toBe(403);
    await makeAdmin(player.user.id);
    const created = await request(app).post('/admin/raffles').set('Authorization', bearer(player.token)).send(input());
    expect(created.status).toBe(201);
    expect((await request(app).get('/raffles')).body).toEqual([]);
    expect((await request(app).post(`/admin/raffles/${created.body.id}/publish`).set('Authorization', bearer(player.token))).status).toBe(200);
    expect((await request(app).put(`/admin/raffles/${created.body.id}`).set('Authorization', bearer(player.token)).send(input())).status).toBe(409);
    const list = await request(app).get('/raffles');
    expect(list.body).toHaveLength(1);
    expect(list.body[0].totalTickets).toBe(100);
    expect(list.body[0].revenueCents).toBeUndefined();
    expect((await request(app).get(`/admin/raffles/${created.body.id}/purchases`)).status).toBe(401);
  });
});

describe('Rifas: compras e Pix', () => {
  it('usa as lacunas disponíveis quando já existem bilhetes antigos no fim da faixa', async () => {
    const player = await registerTestUser(); const raffle = await published({ digits: 1, discounts: [] });
    const first = await buy(player.token, raffle.id, 1);
    await settleRafflePayment(first.body.transactionId, 500, `ORD-${first.body.transactionId}`);
    const oldTicket = await prisma.raffleTicket.findFirstOrThrow({ where: { raffleId: raffle.id } });
    await prisma.raffleTicket.update({ where: { id: oldTicket.id }, data: { number: 9 } });
    const second = await buy(player.token, raffle.id, 9);
    expect(second.status).toBe(201);
    await settleRafflePayment(second.body.transactionId, 4500, `ORD-${second.body.transactionId}`);
    const tickets = await prisma.raffleTicket.findMany({ where: { raffleId: raffle.id }, orderBy: { number: 'asc' } });
    expect(tickets.map((t) => t.number)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(tickets.find((t) => t.id === oldTicket.id)?.number).toBe(9);
  });

  it('não repete números entre confirmações e conserva a emissão ao repetir o webhook', async () => {
    const player = await registerTestUser(); const raffle = await published({ digits: 1, discounts: [] });
    const first = await buy(player.token, raffle.id, 4);
    const second = await buy(player.token, raffle.id, 6);
    await Promise.all([
      settleRafflePayment(first.body.transactionId, 2000, `ORD-${first.body.transactionId}`),
      settleRafflePayment(second.body.transactionId, 3000, `ORD-${second.body.transactionId}`),
    ]);
    const before = await prisma.raffleTicket.findMany({ where: { raffleId: raffle.id }, orderBy: { id: 'asc' } });
    expect(before).toHaveLength(10);
    expect(new Set(before.map((t) => t.number)).size).toBe(10);
    await settleRafflePayment(first.body.transactionId, 2000, `ORD-${first.body.transactionId}`);
    const after = await prisma.raffleTicket.findMany({ where: { raffleId: raffle.id }, orderBy: { id: 'asc' } });
    expect(after).toEqual(before);
  });

  it('gera Pix próprio com desconto e emite bilhetes somente após pagar, uma única vez', async () => {
    const player = await registerTestUser();
    const raffle = await published();
    const res = await buy(player.token, raffle.id, 20);
    expect(res.status).toBe(201);
    const tx = await prisma.transaction.findUniqueOrThrow({ where: { id: res.body.transactionId } });
    expect(tx.type).toBe('PURCHASE_RAFFLE'); expect(Number(tx.amountFiat)).toBe(80);
    expect(await prisma.raffleTicket.count()).toBe(0);
    vi.spyOn(mpOrderClient, 'get').mockResolvedValue({ id: tx.providerReference!, status: 'processed', total_amount: '80.00', external_reference: tx.id } as never);
    await Promise.all([handleMercadoPagoWebhook(tx.providerReference!), handleMercadoPagoWebhook(tx.providerReference!)]);
    expect(await prisma.raffleTicket.count()).toBe(20);
    expect((await prisma.userCredit.findUniqueOrThrow({ where: { userId: player.user.id } })).balance).toBe(0);
    const mine = await request(app).get('/raffles/me/purchases').set('Authorization', bearer(player.token));
    expect(mine.body[0]).toMatchObject({ status: 'PAID', discountPercent: 20, totalCents: 8000 });
    expect(mine.body[0].tickets).toHaveLength(20);
    await makeAdmin(player.user.id);
    const stats = await request(app).get('/admin/raffles').set('Authorization', bearer(player.token));
    expect(stats.body[0]).toMatchObject({ revenueCents: 8000, sold: 20, buyers: 1, reserved: 0 });
  });
  it('não soma compras anteriores para conceder desconto', async () => {
    const player = await registerTestUser(); const raffle = await published();
    await buy(player.token, raffle.id, 5); await buy(player.token, raffle.id, 5);
    const purchases = await prisma.rafflePurchase.findMany();
    expect(purchases.map((p) => p.discountPercent)).toEqual([0, 0]);
  });
  it('impede venda acima da capacidade sob concorrência', async () => {
    const player = await registerTestUser(); const raffle = await published({ digits: 1, discounts: [] });
    const responses = await Promise.all([buy(player.token, raffle.id, 6), buy(player.token, raffle.id, 6)]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.rafflePurchase.count()).toBe(1);
  });
  it('rejeita valor pago divergente e pagamento de outra order', async () => {
    const player = await registerTestUser(); const raffle = await published();
    const res = await buy(player.token, raffle.id, 1);
    await expect(settleRafflePayment(res.body.transactionId, 1, `ORD-${res.body.transactionId}`)).rejects.toThrow('Valor pago');
    await expect(settleRafflePayment(res.body.transactionId, 500, 'outra-order')).rejects.toThrow('não corresponde');
    expect(await prisma.raffleTicket.count()).toBe(0);
  });
  it('libera capacidade somente após status terminal do provedor', async () => {
    const player = await registerTestUser(); const raffle = await published({ digits: 1, discounts: [] });
    const res = await buy(player.token, raffle.id, 10);
    expect((await buy(player.token, raffle.id, 1)).status).toBe(409);
    await settleRafflePayment(res.body.transactionId, null, `ORD-${res.body.transactionId}`);
    expect((await buy(player.token, raffle.id, 10)).status).toBe(201);
  });
  it('não reserva bilhetes se a integração estiver sem configuração', async () => {
    const player = await registerTestUser(); const raffle = await published(); env.mercadoPagoAccessToken = '';
    expect((await buy(player.token, raffle.id, 1)).status).toBe(503);
    expect(await prisma.rafflePurchase.count()).toBe(0);
  });
  it('conserva a reserva em timeout e retoma usando a mesma chave de idempotência', async () => {
    const player = await registerTestUser(); const raffle = await published();
    vi.mocked(mpOrderClient.create).mockRejectedValueOnce(new Error('timeout'));
    expect((await buy(player.token, raffle.id, 2)).status).toBe(502);
    const purchase = await prisma.rafflePurchase.findFirstOrThrow();
    expect(purchase.status).toBe('PENDING');
    const other = await registerTestUser();
    expect((await request(app).post(`/raffles/purchases/${purchase.id}/refresh`).set('Authorization', bearer(other.token))).status).toBe(404);
    vi.spyOn(mpOrderClient, 'get').mockResolvedValue({ id: `ORD-${purchase.transactionId}`, status: 'pending', external_reference: purchase.transactionId } as never);
    const resumed = await request(app).post(`/raffles/purchases/${purchase.id}/refresh`).set('Authorization', bearer(player.token));
    expect(resumed.status).toBe(200);
    expect(mpOrderClient.create).toHaveBeenLastCalledWith(expect.objectContaining({ requestOptions: { idempotencyKey: purchase.transactionId } }));
    expect(await prisma.rafflePurchase.count()).toBe(1);
  });
});

describe('Rifas: apuração', () => {
  it('bloqueia antes do sorteio e com Pix pendente; aceita pagamento emitido antes do fechamento', async () => {
    const player = await registerTestUser(); await makeAdmin(player.user.id); const raffle = await published();
    const res = await buy(player.token, raffle.id, 2);
    await expect(drawRaffle(raffle.id, player.user.id, '1200', 'https://caixa.gov.br')).rejects.toThrow('horário');
    await prisma.raffle.update({ where: { id: raffle.id }, data: { status: 'CLOSED', closesAt: new Date(Date.now() - 2000), drawAt: new Date(Date.now() - 1000) } });
    expect((await buy(player.token, raffle.id, 1)).status).toBe(409);
    await expect(drawRaffle(raffle.id, player.user.id, '1200', 'https://caixa.gov.br')).rejects.toThrow('pendentes');
    await settleRafflePayment(res.body.transactionId, 1000, `ORD-${res.body.transactionId}`);
    const winningTicket = await prisma.raffleTicket.findFirstOrThrow({ where: { raffleId: raffle.id } });
    const resultNumber = `12${String(winningTicket.number).padStart(2, '0')}`;
    const result = await drawRaffle(raffle.id, player.user.id, resultNumber, 'https://caixa.gov.br');
    expect(result.drawnNumber).toBe(winningTicket.number); expect(result.winningPurchaseId).toBe(winningTicket.purchaseId);
    const stored = await prisma.raffle.findUniqueOrThrow({ where: { id: raffle.id } });
    expect(stored.resultRecordedBy).toBe(player.user.id); expect(stored.resultNumber).toBe(resultNumber);
    const publicList = await request(app).get('/raffles');
    expect(publicList.body[0].winner.email).toBeUndefined();
    expect(publicList.body[0].winner.purchaseId).toBeUndefined();
    const adminList = await request(app).get('/admin/raffles').set('Authorization', bearer(player.token));
    expect(adminList.body[0].winner.email).toBe(player.user.email);
    await expect(drawRaffle(raffle.id, player.user.id, '1201', 'https://caixa.gov.br')).rejects.toThrow();
  });
  it('registra número não vendido sem escolher arbitrariamente outro ganhador', async () => {
    const admin = await registerTestUser(); await makeAdmin(admin.user.id);
    const raffle = await published({ closesAt: new Date(Date.now() - 2000), drawAt: new Date(Date.now() - 1000) });
    expect(await drawRaffle(raffle.id, admin.user.id, '12345', 'https://caixa.gov.br')).toEqual({ drawnNumber: 45, winningPurchaseId: null });
  });
});
