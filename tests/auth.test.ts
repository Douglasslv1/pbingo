import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { ageOn, CURRENT_TERMS_VERSION } from '../src/modules/auth/terms';
import { registerTestUser, setCreditBalance } from './helpers';
import { app } from './testApp';

const ADULT = { birthDate: '1990-05-20', acceptTerms: true };

function register(body: Record<string, unknown>) {
  return request(app).post('/auth/register').send(body);
}

/** Data de nascimento de quem faz `years` anos hoje (+/- dias), no formato AAAA-MM-DD. */
function birthDateForAge(years: number, dayOffset = 0): string {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - years);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return date.toISOString().slice(0, 10);
}

describe('Auth', () => {
  it('registra um novo usuario e ja cria carteiras de creditos e premios zeradas', async () => {
    const res = await register({ name: 'Ana', email: 'ana@example.com', password: 'senha1234', ...ADULT });

    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user.termsAccepted).toBe(true);

    const wallet = await request(app).get('/wallet/me').set('Authorization', `Bearer ${res.body.token}`);
    expect(wallet.status).toBe(200);
    expect(wallet.body).toEqual({ credits: { balance: 0 }, prizes: { balanceFiat: '0' } });

    const stored = await prisma.user.findUnique({ where: { email: 'ana@example.com' } });
    expect(stored?.termsVersion).toBe(CURRENT_TERMS_VERSION);
    expect(stored?.birthDate?.toISOString().slice(0, 10)).toBe('1990-05-20');
  });

  it('rejeita cadastro com e-mail ja utilizado', async () => {
    await register({ name: 'Ana', email: 'dup@example.com', password: 'senha1234', ...ADULT });

    const res = await register({ name: 'Outra Pessoa', email: 'dup@example.com', password: 'outrasenha', ...ADULT });

    expect(res.status).toBe(409);
  });

  it('rejeita cadastro com dados invalidos', async () => {
    const res = await register({ name: 'A', email: 'nao-e-email', password: '123', ...ADULT });

    expect(res.status).toBe(422);
  });

  it('faz login com credenciais validas e rejeita credenciais invalidas', async () => {
    await register({ name: 'Bob', email: 'bob@example.com', password: 'senha1234', ...ADULT });

    const ok = await request(app).post('/auth/login').send({ email: 'bob@example.com', password: 'senha1234' });
    expect(ok.status).toBe(200);
    expect(typeof ok.body.token).toBe('string');

    const bad = await request(app).post('/auth/login').send({ email: 'bob@example.com', password: 'errada' });
    expect(bad.status).toBe(401);
  });

  it('rejeita acesso a rotas protegidas sem token', async () => {
    const res = await request(app).get('/wallet/me');
    expect(res.status).toBe(401);
  });
});

describe('Maioridade e aceite dos termos', () => {
  const base = { name: 'Jovem', password: 'senha1234' };

  it('calcula a idade considerando se o aniversario ja passou', () => {
    const today = new Date('2026-09-30T12:00:00Z');
    expect(ageOn(new Date('2008-09-30T00:00:00Z'), today)).toBe(18);
    expect(ageOn(new Date('2008-10-01T00:00:00Z'), today)).toBe(17);
  });

  it('aceita quem faz 18 anos hoje e recusa quem faz amanha', async () => {
    const eighteenToday = await register({ ...base, email: 'hoje@example.com', birthDate: birthDateForAge(18), acceptTerms: true });
    const eighteenTomorrow = await register({
      ...base,
      email: 'amanha@example.com',
      birthDate: birthDateForAge(18, 1),
      acceptTerms: true,
    });

    expect(eighteenToday.status).toBe(201);
    expect(eighteenTomorrow.status).toBe(422);
    expect(await prisma.user.count({ where: { email: 'amanha@example.com' } })).toBe(0);
  });

  it('exige aceite dos termos e data de nascimento valida', async () => {
    const noTerms = await register({ ...base, email: 'a@example.com', birthDate: '1990-01-01', acceptTerms: false });
    const noBirth = await register({ ...base, email: 'b@example.com', acceptTerms: true });
    const badDate = await register({ ...base, email: 'c@example.com', birthDate: '1990-02-31x', acceptTerms: true });

    expect([noTerms.status, noBirth.status, badDate.status]).toEqual([422, 422, 422]);
  });

  it('bloqueia jogar, comprar e sacar para contas antigas ate aceitarem os termos', async () => {
    const { token, user } = await registerTestUser();
    await prisma.user.update({ where: { id: user.id }, data: { termsVersion: null, birthDate: null } });
    await setCreditBalance(user.id, 5);
    await prisma.round.create({ data: { status: 'WAITING', scheduledAt: new Date(Date.now() + 3_600_000) } });

    const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.body.termsAccepted).toBe(false);

    const blocked = await request(app).post('/rounds/join').set('Authorization', `Bearer ${token}`);
    expect(blocked.status).toBe(403);

    const minor = await request(app)
      .post('/auth/accept-terms')
      .set('Authorization', `Bearer ${token}`)
      .send({ birthDate: birthDateForAge(16), acceptTerms: true });
    expect(minor.status).toBe(422);

    const accepted = await request(app)
      .post('/auth/accept-terms')
      .set('Authorization', `Bearer ${token}`)
      .send({ birthDate: '1985-03-10', acceptTerms: true });
    expect(accepted.status).toBe(200);
    expect(accepted.body.termsAccepted).toBe(true);

    const joined = await request(app).post('/rounds/join').set('Authorization', `Bearer ${token}`);
    expect(joined.status).toBe(201);
  });

  it('nova versao dos termos: quem ja informou a data de nascimento so aceita, sem digitar de novo', async () => {
    const { token, user } = await registerTestUser();
    const { birthDate } = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    await prisma.user.update({ where: { id: user.id }, data: { termsVersion: 'versao-antiga' } });

    const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.body).toMatchObject({ termsAccepted: false, hasBirthDate: true });

    const accepted = await request(app)
      .post('/auth/accept-terms')
      .set('Authorization', `Bearer ${token}`)
      .send({ acceptTerms: true });
    expect(accepted.status).toBe(200);
    expect(accepted.body.termsAccepted).toBe(true);
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(saved.birthDate).toEqual(birthDate);
  });

  it('sem data de nascimento registrada, o aceite exige a data', async () => {
    const { token, user } = await registerTestUser();
    await prisma.user.update({ where: { id: user.id }, data: { termsVersion: null, birthDate: null } });

    const missing = await request(app)
      .post('/auth/accept-terms')
      .set('Authorization', `Bearer ${token}`)
      .send({ acceptTerms: true });
    expect(missing.status).toBe(400);
  });

  it('/auth/me devolve o papel atualizado (admin promovido nao precisa sair e entrar)', async () => {
    const { token, user } = await registerTestUser();
    await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });

    const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);

    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ id: user.id, role: 'ADMIN', termsAccepted: true });
    expect(me.body).not.toHaveProperty('passwordHash');
    expect(me.body).not.toHaveProperty('birthDate');
  });
});
