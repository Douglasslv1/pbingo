import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { ACCESS_LOG_RETENTION_DAYS, purgeExpiredAccessLogs } from '../src/modules/auth/accessLog.service';
import { registerTestUser } from './helpers';
import { app } from './testApp';

describe('Registros de acesso (Marco Civil)', () => {
  it('registra cadastro e login com IP e horario', async () => {
    const { user } = await registerTestUser({ email: 'acesso@example.com', password: 'senha1234' });
    await request(app).post('/auth/login').send({ email: 'acesso@example.com', password: 'senha1234' });

    const logs = await prisma.accessLog.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } });
    expect(logs.map((log) => log.event)).toEqual(['REGISTER', 'LOGIN']);
    expect(logs[0].ip).toBeTruthy();
  });

  it('login com senha errada nao gera registro', async () => {
    const { user } = await registerTestUser({ email: 'errou@example.com' });
    await request(app).post('/auth/login').send({ email: 'errou@example.com', password: 'errada' });

    expect(await prisma.accessLog.count({ where: { userId: user.id, event: 'LOGIN' } })).toBe(0);
  });

  it('remove apenas os registros mais antigos que o prazo legal', async () => {
    const { user } = await registerTestUser();
    const day = 24 * 60 * 60 * 1000;
    await prisma.accessLog.createMany({
      data: [
        { userId: user.id, event: 'LOGIN', createdAt: new Date(Date.now() - (ACCESS_LOG_RETENTION_DAYS + 1) * day) },
        { userId: user.id, event: 'LOGIN', createdAt: new Date(Date.now() - (ACCESS_LOG_RETENTION_DAYS - 1) * day) },
      ],
    });

    expect(await purgeExpiredAccessLogs()).toBe(1);
    // Restam o registro dentro do prazo e o do cadastro
    expect(await prisma.accessLog.count({ where: { userId: user.id } })).toBe(2);
  });
});
