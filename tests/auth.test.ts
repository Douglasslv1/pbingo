import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from './testApp';

describe('Auth', () => {
  it('registra um novo usuario e ja cria carteiras de creditos e premios zeradas', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'Ana', email: 'ana@example.com', password: 'senha1234' });

    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe('string');

    const wallet = await request(app).get('/wallet/me').set('Authorization', `Bearer ${res.body.token}`);
    expect(wallet.status).toBe(200);
    expect(wallet.body).toEqual({ credits: { balance: 0 }, prizes: { balanceFiat: '0' } });
  });

  it('rejeita cadastro com e-mail ja utilizado', async () => {
    await request(app)
      .post('/auth/register')
      .send({ name: 'Ana', email: 'dup@example.com', password: 'senha1234' });

    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'Outra Pessoa', email: 'dup@example.com', password: 'outrasenha' });

    expect(res.status).toBe(409);
  });

  it('rejeita cadastro com dados invalidos', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'A', email: 'nao-e-email', password: '123' });

    expect(res.status).toBe(422);
  });

  it('faz login com credenciais validas e rejeita credenciais invalidas', async () => {
    await request(app)
      .post('/auth/register')
      .send({ name: 'Bob', email: 'bob@example.com', password: 'senha1234' });

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
