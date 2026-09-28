import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { registerTestUser } from './helpers';
import { app } from './testApp';

describe('Pix (Mercado Pago)', () => {
  it('retorna erro claro ao tentar criar cobranca sem MERCADOPAGO_ACCESS_TOKEN configurado', async () => {
    const { token } = await registerTestUser();

    const res = await request(app)
      .post('/payments/pix/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ creditsAmount: 5 });

    expect(res.status).toBe(503);
  });

  it('retorna 404 ao consultar status de uma cobranca que nao existe ou nao pertence ao usuario', async () => {
    const { token } = await registerTestUser();

    const res = await request(app)
      .get('/payments/pix/00000000-0000-0000-0000-000000000000/status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
