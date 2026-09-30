import { Request, Response } from 'express';
import { AppError } from '../../utils/errors';
import { getWallet, listMyTransactions } from './wallet.service';
import { historyQuerySchema } from '../../utils/pagination';

export async function getMyWallet(req: Request, res: Response): Promise<void> {
  if (!req.userId) {
    throw new AppError('Não autenticado', 401);
  }

  const wallet = await getWallet(req.userId);
  res.status(200).json(wallet);
}

export async function getMyTransactions(req: Request, res: Response): Promise<void> {
  if (!req.userId) {
    throw new AppError('Não autenticado', 401);
  }

  const page = historyQuerySchema.parse(req.query);
  res.status(200).json(await listMyTransactions(req.userId, page));
}
