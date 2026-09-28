import { Request, Response } from 'express';
import { AppError } from '../../utils/errors';
import { getWallet } from './wallet.service';

export async function getMyWallet(req: Request, res: Response): Promise<void> {
  if (!req.userId) {
    throw new AppError('Nao autenticado', 401);
  }

  const wallet = await getWallet(req.userId);
  res.status(200).json(wallet);
}
