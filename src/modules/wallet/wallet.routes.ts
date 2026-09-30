import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { getMyTransactions, getMyWallet } from './wallet.controller';

export const walletRouter = Router();

walletRouter.get('/me', authMiddleware, asyncHandler(getMyWallet));
walletRouter.get('/transactions', authMiddleware, asyncHandler(getMyTransactions));
