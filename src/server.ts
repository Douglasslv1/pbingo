import { createServer } from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { purgeExpiredAccessLogs } from './modules/auth/accessLog.service';
import { setUserRole } from './modules/auth/userRole.service';
import { cancelStaleQueues } from './modules/domino/domino.service';
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

const DAY_MS = 24 * 60 * 60 * 1000;

/** Apaga diariamente os registros de acesso que passaram do prazo legal de guarda. */
function schedulePurgeOfAccessLogs(): void {
  const purge = () =>
    purgeExpiredAccessLogs()
      .then((count) => count > 0 && logger.info('Registros de acesso expirados removidos', { count }))
      .catch((err) => logger.error('Erro ao remover registros de acesso expirados', { err }));
  purge();
  setInterval(purge, DAY_MS).unref();
}

const DOMINO_QUEUE_SWEEP_MS = 30 * 1000;

/** Cancela, a cada 30s, mesas de domino que nao completaram jogadores no prazo (tambem apos reinicio). */
function scheduleDominoQueueSweep(): void {
  const sweep = () =>
    cancelStaleQueues().catch((err) => logger.error('Erro ao cancelar mesas de domino paradas', { err }));
  sweep();
  setInterval(sweep, DOMINO_QUEUE_SWEEP_MS).unref();
}

const app = createApp();
const httpServer = createServer(app);

initSocket(httpServer);

httpServer.listen(env.port, () => {
  logger.info('Servidor Bingo Online iniciado', { port: env.port });
  roundEngine.start().catch((err) => {
    logger.error('Erro ao iniciar o motor de rodadas', { err });
  });
  schedulePurgeOfAccessLogs();
  scheduleDominoQueueSweep();
  promoteBootstrapAdmin().catch((err) => {
    logger.error('Erro ao promover BOOTSTRAP_ADMIN_EMAIL', { err });
  });
});
