import cors from 'cors';
import express, { Express } from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware';
import { createRateLimiter } from './middleware/rateLimit.middleware';
import { requestLogger } from './middleware/requestLogger.middleware';
import { adminStatsRouter } from './modules/admin/admin.routes';
import { authRouter } from './modules/auth/auth.routes';
import { damasRouters, xadrezRouters } from './modules/board/board.routes';
import { ludoRouters } from './modules/ludo/ludo.routes';
import { CURRENT_TERMS_VERSION } from './modules/auth/terms';
import { STAKES } from './modules/tables/tables.types';
import { adminDominoRouter, dominoRouter } from './modules/domino/domino.routes';
import { paymentsRouter } from './modules/payments/payments.routes';
import { profileRouter } from './modules/profile/profile.routes';
import { rankingRouter } from './modules/ranking/ranking.routes';
import { roundsRouter } from './modules/rounds/rounds.routes';
import { adminTrucoRouter, trucoRouter } from './modules/truco/truco.routes';
import { venoxRouter } from './modules/venox/venox.routes';
import { walletRouter } from './modules/wallet/wallet.routes';
import { adminWithdrawalsRouter, withdrawalsRouter } from './modules/withdrawals/withdrawals.routes';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

interface AppOptions {
  rateLimitEnabled?: boolean;
}

/** Limites por IP das rotas sensiveis a forca bruta, spam e abuso. */
function applyRateLimits(app: Express): void {
  app.post(
    '/auth/login',
    createRateLimiter({ windowMs: 15 * MINUTE_MS, max: 20, message: 'Muitas tentativas de login. Aguarde alguns minutos.' }),
  );
  app.post(
    '/auth/register',
    createRateLimiter({ windowMs: HOUR_MS, max: 5, message: 'Muitos cadastros a partir desta rede. Tente mais tarde.' }),
  );
  app.post(
    ['/auth/forgot-password', '/auth/reset-password'],
    createRateLimiter({ windowMs: HOUR_MS, max: 5, message: 'Muitos pedidos de redefinição de senha. Tente mais tarde.' }),
  );
  app.post(
    '/withdrawals',
    createRateLimiter({ windowMs: HOUR_MS, max: 10, message: 'Muitos pedidos de saque. Tente mais tarde.' }),
  );
  app.post(
    '/payments/pix/create',
    createRateLimiter({ windowMs: HOUR_MS, max: 20, message: 'Muitas cobranças Pix geradas. Tente mais tarde.' }),
  );
}

export function createApp({ rateLimitEnabled = env.rateLimitEnabled }: AppOptions = {}): Express {
  const app = express();

  // Quantos proxies do Railway ficam na frente: com o valor errado, req.ip vira o IP do proxy
  // e todos os jogadores passam a dividir o mesmo limite de tentativas
  app.set('trust proxy', env.trustProxyHops);

  app.use(requestLogger);
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins.length > 0 ? env.corsOrigins : true }));
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // Regras do jogo exibidas no app; mudam por variavel de ambiente, sem novo deploy do frontend
  app.get('/config', (_req, res) => {
    res.status(200).json({
      creditPriceBrl: env.creditPriceBrl,
      ticketPriceCredits: env.ticketPriceCredits,
      prizeContributionPerTicket: env.prizeContributionPerTicket,
      minPlayersPerRound: env.minPlayersPerRound,
      roundIntervalMinutes: env.roundIntervalMinutes,
      minWithdrawalBrl: env.minWithdrawalBrl,
      houseFeePercent: env.houseFeePercent,
      termsVersion: CURRENT_TERMS_VERSION,
      dominoEnabled: env.dominoEnabled,
      dominoFree: env.dominoFree,
      dominoTurnSeconds: env.dominoTurnSeconds,
      trucoEnabled: env.trucoEnabled,
      trucoTurnSeconds: env.trucoTurnSeconds,
      damasEnabled: env.damasEnabled,
      xadrezEnabled: env.xadrezEnabled,
      boardGamesFree: env.boardGamesFree,
      boardTurnSeconds: env.boardTurnSeconds,
      ludoEnabled: env.ludoEnabled,
      ludoFree: env.ludoFree,
      ludoTurnSeconds: env.ludoTurnSeconds,
      queueTimeoutMinutes: env.queueTimeoutMinutes,
      stakes: STAKES,
    });
  });

  if (rateLimitEnabled) {
    applyRateLimits(app);
  }

  app.use('/auth', authRouter);
  app.use('/wallet', walletRouter);
  app.use('/venox', venoxRouter);
  app.use('/profile', profileRouter);
  app.use('/ranking', rankingRouter);
  app.use('/payments', paymentsRouter);
  app.use('/rounds', roundsRouter);
  app.use('/withdrawals', withdrawalsRouter);
  app.use('/admin/withdrawals', adminWithdrawalsRouter);
  app.use('/domino', dominoRouter);
  app.use('/admin/domino', adminDominoRouter);
  app.use('/truco', trucoRouter);
  app.use('/admin/truco', adminTrucoRouter);
  app.use('/damas', damasRouters.router);
  app.use('/admin/damas', damasRouters.admin);
  app.use('/xadrez', xadrezRouters.router);
  app.use('/admin/xadrez', xadrezRouters.admin);
  app.use('/ludo', ludoRouters.router);
  app.use('/admin/ludo', ludoRouters.admin);
  app.use('/admin/stats', adminStatsRouter);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
