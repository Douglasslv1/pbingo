import { createServer } from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { roundEngine } from './modules/rounds/round.engine';
import { initSocket } from './websocket/socket';

if (env.isProduction && env.corsOrigins.length === 0) {
  console.warn('CORS_ORIGINS nao configurada: a API esta aceitando requisicoes de qualquer origem');
}

const app = createApp();
const httpServer = createServer(app);

initSocket(httpServer);

httpServer.listen(env.port, () => {
  console.log(`Servidor Bingo Online rodando na porta ${env.port}`);
  roundEngine.start().catch((err) => {
    console.error('Erro ao iniciar o motor de rodadas', err);
  });
});
