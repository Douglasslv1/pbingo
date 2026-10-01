import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeAdmin, registerTestUser } from './helpers';
import { app } from './testApp';

describe('Painel admin: visao geral', () => {
  it('mostra os numeros da plataforma so para admins', async () => {
    const admin = await registerTestUser();
    await makeAdmin(admin.user.id);
    const player = await registerTestUser();
    await request(app).post('/auth/login').send({ email: player.user.email, password: 'senha1234' });

    const blocked = await request(app).get('/admin/stats').set('Authorization', `Bearer ${player.token}`);
    expect(blocked.status).toBe(403);

    const res = await request(app).get('/admin/stats').set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.users).toMatchObject({ total: 2, newToday: 2, everLoggedIn: 1, activeToday: 2 });
    expect(res.body.recentUsers[0].email).toBe(player.user.email);
  });
});
