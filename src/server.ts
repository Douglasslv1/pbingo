import { createServer } from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
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

const app = createApp();
const httpServer = createServer(app);

initSocket(httpServer);

httpServer.listen(env.port, () => {
  logger.info('Servidor Bingo Online iniciado', { port: env.port });
  roundEngine.start().catch((err) => {
    logger.error('Erro ao iniciar o motor de rodadas', { err });
  });
});
