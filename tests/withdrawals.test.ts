import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { isValidCpf } from '../src/utils/cpf';
import { makeAdmin, registerTestUser, setPrizeBalance } from './helpers';
import { app } from './testApp';

const VALID_CPF = '529.982.247-25';

function pixPayload(amount: number, overrides: Record<string, unknown> = {}) {
  return { amount, cpf: VALID_CPF, pixKeyType: 'EMAIL', pixKey: 'Jogador@Example.com', ...overrides };
}

function withdraw(token: string, body: Record<string, unknown>) {
  return request(app).post('/withdrawals').set('Authorization', `Bearer ${token}`).send(body);
}

function review(token: string, withdrawalId: string, action: 'pay' | 'reject', body: Record<string, unknown>) {
  return request(app)
    .post(`/admin/withdrawals/${withdrawalId}/${action}`)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

async function prizeBalance(userId: string): Promise<string | undefined> {
  const prize = await prisma.userPrize.findUnique({ where: { userId } });
  return prize?.balanceFiat.toString();
}

async function transactionStatusOf(withdrawalId: string): Promise<string | undefined> {
  const withdrawal = await prisma.withdrawal.findUnique({ where: { id: withdrawalId }, include: { transaction: true } });
  return withdrawal?.transaction.status;
}

async function playerWithPendingWithdrawal(balance: number, amount: number) {
  const player = await registerTestUser();
  await setPrizeBalance(player.user.id, balance);
  const res = await withdraw(player.token, pixPayload(amount));
  return { ...player, withdrawalId: res.body.withdrawalId as string };
}

async function adminToken(): Promise<string> {
  const admin = await registerTestUser();
  await makeAdmin(admin.user.id);
  return admin.token;
}

describe('CPF', () => {
  it('valida digitos verificadores com ou sem pontuacao', () => {
    expect(isValidCpf(VALID_CPF)).toBe(true);
    expect(isValidCpf('52998224725')).toBe(true);
    expect(isValidCpf('529.982.247-24')).toBe(false);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('123')).toBe(false);
  });
});

describe('Withdrawals - solicitacao', () => {
  it('cria o pedido pendente com os dados Pix normalizados e debita o saldo', async () => {
    const { token, user } = await registerTestUser();
    await setPrizeBalance(user.id, 5);

    const res = await withdraw(token, pixPayload(3));

    expect(res.status).toBe(201);
    expect(res.body.remainingBalance).toBe('2');

    const withdrawal = await prisma.withdrawal.findUnique({ where: { id: res.body.withdrawalId } });
    expect(withdrawal).toMatchObject({ status: 'PENDING', cpf: '52998224725', pixKey: 'jogador@example.com' });
    expect(await transactionStatusOf(res.body.withdrawalId)).toBe('PENDING');
  });

  it('normaliza chave Pix de telefone para o formato +55', async () => {
    const { token, user } = await registerTestUser();
    await setPrizeBalance(user.id, 5);

    const res = await withdraw(token, pixPayload(2, { pixKeyType: 'PHONE', pixKey: '(11) 98765-4321' }));

    expect(res.status).toBe(201);
    const withdrawal = await prisma.withdrawal.findUnique({ where: { id: res.body.withdrawalId } });
    expect(withdrawal?.pixKey).toBe('+5511987654321');
  });

  it('rejeita CPF invalido, chave Pix incompativel e centavos fracionados sem debitar o saldo', async () => {
    const { token, user } = await registerTestUser();
    await setPrizeBalance(user.id, 5);

    const badCpf = await withdraw(token, pixPayload(2, { cpf: '123.456.789-00' }));
    const badKey = await withdraw(token, pixPayload(2, { pixKeyType: 'RANDOM', pixKey: 'nao-e-uuid' }));
    const badCents = await withdraw(token, pixPayload(2.555));

    expect([badCpf.status, badKey.status, badCents.status]).toEqual([422, 422, 422]);
    expect(await prizeBalance(user.id)).toBe('5');
  });

  it('rejeita saque abaixo do valor minimo', async () => {
    const { token, user } = await registerTestUser();
    await setPrizeBalance(user.id, 5);

    const res = await withdraw(token, pixPayload(0.5));

    expect(res.status).toBe(400);
    expect(await prizeBalance(user.id)).toBe('5');
  });

  it('rejeita saque quando o saldo sacavel e insuficiente', async () => {
    const { token, user } = await registerTestUser();
    await setPrizeBalance(user.id, 5);

    const res = await withdraw(token, pixPayload(100));

    expect(res.status).toBe(400);
    expect(await prizeBalance(user.id)).toBe('5');
  });

  it('nunca permite saldo de premios negativo sob concorrencia (dois saques simultaneos do mesmo saldo total)', async () => {
    const { token, user } = await registerTestUser();
    await setPrizeBalance(user.id, 10);

    const [r1, r2] = await Promise.all([withdraw(token, pixPayload(10)), withdraw(token, pixPayload(10))]);

    const statuses = [r1.status, r2.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 400]);
    expect(Number(await prizeBalance(user.id))).toBe(0);
  });

  it('lista apenas os saques do proprio jogador', async () => {
    const alice = await playerWithPendingWithdrawal(5, 2);
    await playerWithPendingWithdrawal(5, 3);

    const res = await request(app).get('/withdrawals/me').set('Authorization', `Bearer ${alice.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: alice.withdrawalId, amountFiat: '2', status: 'PENDING' });
  });
});

describe('Withdrawals - revisao pelo admin', () => {
  it('bloqueia jogadores comuns no painel admin', async () => {
    const player = await playerWithPendingWithdrawal(5, 2);

    const list = await request(app).get('/admin/withdrawals').set('Authorization', `Bearer ${player.token}`);
    const pay = await review(player.token, player.withdrawalId, 'pay', { paymentReference: 'E1' });

    expect([list.status, pay.status]).toEqual([403, 403]);
    expect(await transactionStatusOf(player.withdrawalId)).toBe('PENDING');
  });

  it('lista os pendentes com os dados do jogador', async () => {
    const player = await playerWithPendingWithdrawal(5, 2);
    const token = await adminToken();

    const res = await request(app).get('/admin/withdrawals?status=PENDING').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      id: player.withdrawalId,
      pixKey: 'jogador@example.com',
      user: { id: player.user.id, email: player.user.email },
    });
  });

  it('marca como pago, conclui a transacao e nao permite revisar de novo', async () => {
    const player = await playerWithPendingWithdrawal(5, 2);
    const token = await adminToken();

    const res = await review(token, player.withdrawalId, 'pay', { paymentReference: 'E12345678202609301200abc' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'PAID', paymentReference: 'E12345678202609301200abc' });
    expect(await transactionStatusOf(player.withdrawalId)).toBe('COMPLETED');
    expect(await prizeBalance(player.user.id)).toBe('3');

    const again = await review(token, player.withdrawalId, 'reject', { reason: 'Tentativa duplicada' });
    expect(again.status).toBe(409);
    expect(await prizeBalance(player.user.id)).toBe('3');
  });

  it('recusa o saque e devolve o valor ao saldo de premios', async () => {
    const player = await playerWithPendingWithdrawal(5, 2);
    const token = await adminToken();

    const res = await review(token, player.withdrawalId, 'reject', { reason: 'Chave Pix nao pertence ao CPF informado' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'REJECTED', rejectionReason: 'Chave Pix nao pertence ao CPF informado' });
    expect(await prizeBalance(player.user.id)).toBe('5');
    expect(await transactionStatusOf(player.withdrawalId)).toBe('REJECTED');
  });

  it('pagar e recusar ao mesmo tempo: so uma revisao vence e o saldo fica consistente', async () => {
    const player = await playerWithPendingWithdrawal(5, 2);
    const token = await adminToken();

    const [pay, reject] = await Promise.all([
      review(token, player.withdrawalId, 'pay', { paymentReference: 'E1' }),
      review(token, player.withdrawalId, 'reject', { reason: 'Duplicado' }),
    ]);

    expect([pay.status, reject.status].sort((a, b) => a - b)).toEqual([200, 409]);
    expect(await prizeBalance(player.user.id)).toBe(pay.status === 200 ? '3' : '5');
  });

  it('responde 422 para id malformado e 404 para saque inexistente', async () => {
    const token = await adminToken();

    const malformed = await review(token, 'abc', 'pay', { paymentReference: 'E1' });
    const missing = await review(token, '00000000-0000-0000-0000-000000000000', 'pay', { paymentReference: 'E1' });

    expect(malformed.status).toBe(422);
    expect(missing.status).toBe(404);
  });
});
