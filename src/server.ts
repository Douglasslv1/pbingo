import { createServer } from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { setUserRole } from './modules/auth/userRole.service';
import { roundEngine } from './modules/rounds/round.engine';
import { initSocket } from './websocket/socket';

if (env.isProduction && env.corsOrigins.length === 0) {
  logger.warn('CORS_ORIGINS nao configurada: a API esta aceitando requisicoes de qualquer origem');
}

process.on('unhandledRejection', (reason) => {
  logger.error('Promise rejeitada sem tratamento', { err: reason });
});
process.on('uncaughtException', (err) => {
  logger.error('Excecao nao capturada - encerrando', { err });
  process.exit(1);
});

/**
 * Promove a admin a conta em BOOTSTRAP_ADMIN_EMAIL ao iniciar - para criar o primeiro admin
 * sem acesso direto ao banco. Remova a variavel depois de usar.
 */
async function promoteBootstrapAdmin(): Promise<void> {
  if (!env.bootstrapAdminEmail) return;

  const promoted = await setUserRole(env.bootstrapAdminEmail, 'ADMIN');
  if (promoted) {
    logger.warn('Conta promovida a admin via BOOTSTRAP_ADMIN_EMAIL - remova a variavel', {
      email: env.bootstrapAdminEmail,
    });
  } else {
    logger.error('BOOTSTRAP_ADMIN_EMAIL nao corresponde a nenhuma conta', { email: env.bootstrapAdminEmail });
  }
}

const app = createApp();
const httpServer = createServer(app);

initSocket(httpServer);

httpServer.listen(env.port, () => {
  logger.info('Servidor Bingo Online iniciado', { port: env.port });
  roundEngine.start().catch((err) => {
    logger.error('Erro ao iniciar o motor de rodadas', { err });
  });
  promoteBootstrapAdmin().catch((err) => {
    logger.error('Erro ao promover BOOTSTRAP_ADMIN_EMAIL', { err });
  });
});
