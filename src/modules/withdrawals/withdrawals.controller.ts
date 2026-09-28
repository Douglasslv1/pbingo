import { Request, Response } from 'express';
import { AppError } from '../../utils/errors';
import { requestWithdrawal } from './withdrawals.service';
import { withdrawalSchema } from './withdrawals.types';

export async function createWithdrawal(req: Request, res: Response): Promise<void> {
  if (!req.userId) {
    throw new AppError('Nao autenticado', 401);
  }
  const input = withdrawalSchema.parse(req.body);
  const result = await requestWithdrawal(req.userId, input);
  res.status(201).json(result);
}
