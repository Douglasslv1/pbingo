import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';

export type AccessEvent = 'REGISTER' | 'LOGIN' | 'ACCEPT_TERMS' | 'PASSWORD_RESET';

/** Marco Civil da Internet (art. 15): registros de acesso a aplicacao guardados por 6 meses. */
export const ACCESS_LOG_RETENTION_DAYS = 183;

/** Registra o acesso sem nunca derrubar a acao do usuario se o registro falhar. */
export async function recordAccess(userId: string, event: AccessEvent, ip: string | undefined): Promise<void> {
  try {
    await prisma.accessLog.create({ data: { userId, event, ip: ip ?? null } });
  } catch (err) {
    logger.error('Falha ao registrar acesso', { userId, event, err });
  }
}

/** Remove registros de acesso mais antigos que o prazo legal de guarda. */
export async function purgeExpiredAccessLogs(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - ACCESS_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const { count } = await prisma.accessLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return count;
}
