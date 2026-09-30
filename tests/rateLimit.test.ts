import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

describe('Limite de tentativas por IP', () => {
  it('bloqueia o login apos 20 tentativas na janela e informa quando tentar de novo', async () => {
    const app = createApp({ rateLimitEnabled: true });
    const credentials = { email: 'alvo@example.com', password: 'chute-errado' };

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const res = await request(app).post('/auth/login').send(credentials);
      expect(res.status).toBe(401);
    }

    const blocked = await request(app).post('/auth/login').send(credentials);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('conta cada rota separadamente', async () => {
    const app = createApp({ rateLimitEnabled: true });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app).post('/auth/register').send({});
    }
    const registerBlocked = await request(app).post('/auth/register').send({});
    const loginStillOpen = await request(app).post('/auth/login').send({ email: 'x@example.com', password: 'x' });

    expect(registerBlocked.status).toBe(429);
    expect(loginStillOpen.status).toBe(401);
  });
});
