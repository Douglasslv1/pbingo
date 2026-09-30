import cors from 'cors';
import express, { Express } from 'express';
import helmet from 'helmet';
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware';
import { authRouter } from './modules/auth/auth.routes';
import { paymentsRouter } from './modules/payments/payments.routes';
import { roundsRouter } from './modules/rounds/rounds.routes';
import { walletRouter } from './modules/wallet/wallet.routes';
import { adminWithdrawalsRouter, withdrawalsRouter } from './modules/withdrawals/withdrawals.routes';

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/auth', authRouter);
  app.use('/wallet', walletRouter);
  app.use('/payments', paymentsRouter);
  app.use('/rounds', roundsRouter);
  app.use('/withdrawals', withdrawalsRouter);
  app.use('/admin/withdrawals', adminWithdrawalsRouter);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
