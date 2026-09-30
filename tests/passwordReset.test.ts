import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';
import { env } from '../src/config/env';
import { EmailMessage, mailer } from '../src/lib/mailer';
import { prisma } from '../src/lib/prisma';
import { registerTestUser } from './helpers';
import { app } from './testApp';

let sendSpy: MockInstance<(message: EmailMessage) => Promise<void>>;

beforeEach(() => {
  sendSpy = vi.spyOn(mailer, 'send').mockResolvedValue();
});

afterEach(() => {
  sendSpy.mockRestore();
});

function forgot(email: string) {
  return request(app).post('/auth/forgot-password').send({ email });
}

function reset(token: string, password: string) {
  return request(app).post('/auth/reset-password').send({ token, password });
}

/** Espera o e-mail enviado em segundo plano e extrai o token do link. */
async function waitForResetToken(callIndex = 0): Promise<string> {
  await vi.waitFor(() => expect(sendSpy.mock.calls.length).toBeGreaterThan(callIndex));
  const message = sendSpy.mock.calls[callIndex][0];
  const token = message.text.match(/token=([0-9a-f]{64})/)?.[1];
  expect(token).toBeDefined();
  return token!;
}

describe('Recuperacao de senha', () => {
  it('responde igual para e-mail inexistente e nao envia nada', async () => {
    const res = await forgot('ninguem@example.com');

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/Se houver uma conta/);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('envia o link (ignorando maiusculas no e-mail) e troca a senha uma unica vez', async () => {
    const { user } = await registerTestUser({ email: 'maria@example.com', password: 'senhaAntiga1' });

    const res = await forgot('Maria@Example.com');
    expect(res.status).toBe(200);

    const token = await waitForResetToken();
    expect(sendSpy.mock.calls[0][0].to).toBe(user.email);
    expect(sendSpy.mock.calls[0][0].text).toContain(`${env.frontendUrl}/redefinir-senha?token=`);

    const stored = await prisma.passwordResetToken.findFirst({ where: { userId: user.id } });
    expect(stored?.tokenHash).not.toBe(token);

    expect((await reset(token, 'senhaNova123')).status).toBe(200);

    const oldLogin = await request(app).post('/auth/login').send({ email: user.email, password: 'senhaAntiga1' });
    const newLogin = await request(app).post('/auth/login').send({ email: user.email, password: 'senhaNova123' });
    expect([oldLogin.status, newLogin.status]).toEqual([401, 200]);

    const reuse = await reset(token, 'outraSenha123');
    expect(reuse.status).toBe(400);
  });

  it('um novo pedido invalida o link anterior', async () => {
    const { user } = await registerTestUser();

    await forgot(user.email);
    const firstToken = await waitForResetToken(0);
    await forgot(user.email);
    const secondToken = await waitForResetToken(1);

    expect((await reset(firstToken, 'senhaNova123')).status).toBe(400);
    expect((await reset(secondToken, 'senhaNova123')).status).toBe(200);
  });

  it('recusa link expirado', async () => {
    const { user } = await registerTestUser();
    await forgot(user.email);
    const token = await waitForResetToken();
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect((await reset(token, 'senhaNova123')).status).toBe(400);
  });

  it('encerra as sessoes abertas antes da troca de senha', async () => {
    const { user } = await registerTestUser();
    const oneMinuteAgo = Math.floor(Date.now() / 1000) - 60;
    const oldSession = jwt.sign({ userId: user.id, iat: oneMinuteAgo }, env.jwtSecret);

    const before = await request(app).get('/wallet/me').set('Authorization', `Bearer ${oldSession}`);
    expect(before.status).toBe(200);

    await forgot(user.email);
    await reset(await waitForResetToken(), 'senhaNova123');

    const after = await request(app).get('/wallet/me').set('Authorization', `Bearer ${oldSession}`);
    expect(after.status).toBe(401);
  });

  it('valida o formato do token e o tamanho da nova senha', async () => {
    expect((await reset('abc', 'senhaNova123')).status).toBe(422);
    expect((await reset('a'.repeat(64), 'curta')).status).toBe(422);
    expect((await reset('a'.repeat(64), 'senhaNova123')).status).toBe(400);
  });
});
