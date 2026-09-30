import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { confirmPasswordReset, forgotPassword, login, register } from './auth.controller';

export const authRouter = Router();

authRouter.post('/register', asyncHandler(register));
authRouter.post('/login', asyncHandler(login));
authRouter.post('/forgot-password', asyncHandler(forgotPassword));
authRouter.post('/reset-password', asyncHandler(confirmPasswordReset));
