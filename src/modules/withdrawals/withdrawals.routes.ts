import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { createWithdrawal } from './withdrawals.controller';

export const withdrawalsRouter = Router();

withdrawalsRouter.post('/', authMiddleware, asyncHandler(createWithdrawal));
