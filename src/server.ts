import { createServer } from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { roundEngine } from './modules/rounds/round.engine';
import { initSocket } from './websocket/socket';

const app = createApp();
const httpServer = createServer(app);

initSocket(httpServer);

httpServer.listen(env.port, () => {
  console.log(`Servidor Bingo Online rodando na porta ${env.port}`);
  roundEngine.start().catch((err) => {
    console.error('Erro ao iniciar o motor de rodadas', err);
  });
});
