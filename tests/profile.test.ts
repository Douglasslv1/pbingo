import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { registerTestUser } from './helpers';
import { app } from './testApp';

const setNickname = (token: string, nickname: string) =>
  request(app).put('/profile/me/nickname').set('Authorization', `Bearer ${token}`).send({ nickname });

describe('Perfil e apelido', () => {
  it('sem apelido o jogador aparece como "Jogador #0000", nunca pelo nome real', async () => {
    const player = await registerTestUser({ name: 'Maria Souza' });
    const profile = await request(app).get('/profile/me').set('Authorization', `Bearer ${player.token}`);
    expect(profile.body.nickname).toBeNull();
    expect(profile.body.displayName).toMatch(/^Jogador #\d{4}$/);
    expect(profile.body.games.TRUCO).toEqual({ matches: 0, wins: 0, prizes: '0' });
  });

  it('valida formato, palavras proibidas e unicidade sem diferenciar maiusculas', async () => {
    const [a, b] = await Promise.all([registerTestUser(), registerTestUser()]);
    expect((await setNickname(a.token, 'ab')).status).toBe(422);
    expect((await setNickname(a.token, 'com espaco')).status).toBe(422);
    expect((await setNickname(a.token, 'Admin')).status).toBe(422);
    expect((await setNickname(a.token, 'M3rd4_total')).status).toBe(422);

    expect((await setNickname(a.token, 'Zap_do_Truco')).status).toBe(200);
    const clash = await setNickname(b.token, 'zap_do_truco');
    expect(clash.status).toBe(409);
    expect(clash.body.error).toBe('Este apelido já está em uso');
    // Nomes comuns que contem pedacos parecidos continuam liberados
    expect((await setNickname(b.token, 'Paulo.Computador')).status).toBe(200);
  });

  it('a primeira escolha e livre; trocar de novo so depois de 30 dias', async () => {
    const player = await registerTestUser();
    expect((await setNickname(player.token, 'Primeiro')).status).toBe(200);
    const blocked = await setNickname(player.token, 'Segundo');
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toMatch(/^Você poderá trocar o apelido a partir de/);

    await prisma.user.update({
      where: { id: player.user.id },
      data: { nicknameChangedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) },
    });
    const changed = await setNickname(player.token, 'Segundo');
    expect(changed.body).toMatchObject({ nickname: 'Segundo', displayName: 'Segundo' });

    const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${player.token}`);
    expect(me.body.nickname).toBe('Segundo');
  });
});
