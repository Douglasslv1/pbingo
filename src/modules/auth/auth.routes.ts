import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { confirmPasswordReset, confirmTerms, forgotPassword, login, me, register } from './auth.controller';

export const authRouter = Router();

authRouter.post('/register', asyncHandler(register));
authRouter.post('/login', asyncHandler(login));
authRouter.post('/forgot-password', asyncHandler(forgotPassword));
authRouter.post('/reset-password', asyncHandler(confirmPasswordReset));
authRouter.get('/me', authMiddleware, asyncHandler(me));
authRouter.post('/accept-terms', authMiddleware, asyncHandler(confirmTerms));
