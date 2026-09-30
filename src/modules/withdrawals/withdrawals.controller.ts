import { Request, Response } from 'express';
import { AppError } from '../../utils/errors';
import {
  listMyWithdrawals,
  listWithdrawalsForReview,
  markWithdrawalPaid,
  rejectWithdrawal,
  requestWithdrawal,
} from './withdrawals.service';
import {
  markPaidSchema,
  rejectSchema,
  withdrawalIdParamSchema,
  withdrawalSchema,
  withdrawalStatusFilterSchema,
} from './withdrawals.types';

function requireUserId(req: Request): string {
  if (!req.userId) {
    throw new AppError('Não autenticado', 401);
  }
  return req.userId;
}

export async function createWithdrawal(req: Request, res: Response): Promise<void> {
  const input = withdrawalSchema.parse(req.body);
  const result = await requestWithdrawal(requireUserId(req), input);
  res.status(201).json(result);
}

export async function getMyWithdrawals(req: Request, res: Response): Promise<void> {
  res.status(200).json(await listMyWithdrawals(requireUserId(req)));
}

export async function getWithdrawalsForReview(req: Request, res: Response): Promise<void> {
  const { status } = withdrawalStatusFilterSchema.parse(req.query);
  res.status(200).json(await listWithdrawalsForReview(status));
}

export async function payWithdrawal(req: Request, res: Response): Promise<void> {
  const { id } = withdrawalIdParamSchema.parse(req.params);
  const { paymentReference } = markPaidSchema.parse(req.body);
  res.status(200).json(await markWithdrawalPaid(id, requireUserId(req), paymentReference));
}

export async function refuseWithdrawal(req: Request, res: Response): Promise<void> {
  const { id } = withdrawalIdParamSchema.parse(req.params);
  const { reason } = rejectSchema.parse(req.body);
  res.status(200).json(await rejectWithdrawal(id, requireUserId(req), reason));
}
