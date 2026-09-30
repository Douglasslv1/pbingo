import { Router } from 'express';
import { adminMiddleware } from '../../middleware/admin.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireTermsAccepted } from '../../middleware/terms.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  createWithdrawal,
  getMyWithdrawals,
  getWithdrawalsForReview,
  payWithdrawal,
  refuseWithdrawal,
} from './withdrawals.controller';

export const withdrawalsRouter = Router();

withdrawalsRouter.post('/', authMiddleware, asyncHandler(requireTermsAccepted), asyncHandler(createWithdrawal));
withdrawalsRouter.get('/me', authMiddleware, asyncHandler(getMyWithdrawals));

export const adminWithdrawalsRouter = Router();

adminWithdrawalsRouter.use(authMiddleware, asyncHandler(adminMiddleware));
adminWithdrawalsRouter.get('/', asyncHandler(getWithdrawalsForReview));
adminWithdrawalsRouter.post('/:id/pay', asyncHandler(payWithdrawal));
adminWithdrawalsRouter.post('/:id/reject', asyncHandler(refuseWithdrawal));
