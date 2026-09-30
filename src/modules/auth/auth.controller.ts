import { Request, Response } from 'express';
import { logger } from '../../lib/logger';
import { AppError } from '../../utils/errors';
import { recordAccess } from './accessLog.service';
import { acceptTerms, getCurrentUser, loginUser, registerUser } from './auth.service';
import {
  acceptTermsSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from './auth.types';
import { requestPasswordReset, resetPassword } from './passwordReset.service';

const FORGOT_PASSWORD_RESPONSE = {
  message: 'Se houver uma conta com este e-mail, enviaremos um link para redefinir a senha.',
};

export async function register(req: Request, res: Response): Promise<void> {
  const input = registerSchema.parse(req.body);
  const result = await registerUser(input);
  await recordAccess(result.user.id, 'REGISTER', req.ip);
  res.status(201).json(result);
}

export async function login(req: Request, res: Response): Promise<void> {
  const input = loginSchema.parse(req.body);
  const result = await loginUser(input);
  await recordAccess(result.user.id, 'LOGIN', req.ip);
  res.status(200).json(result);
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = forgotPasswordSchema.parse(req.body);
  // Sem await: a resposta (conteudo e tempo) nao pode revelar quais e-mails tem conta
  requestPasswordReset(email).catch((err) => {
    logger.error('Erro ao enviar e-mail de redefinição de senha', { requestId: req.requestId, err });
  });
  res.status(200).json(FORGOT_PASSWORD_RESPONSE);
}

export async function confirmPasswordReset(req: Request, res: Response): Promise<void> {
  const { token, password } = resetPasswordSchema.parse(req.body);
  const userId = await resetPassword(token, password);
  await recordAccess(userId, 'PASSWORD_RESET', req.ip);
  res.status(200).json({ message: 'Senha redefinida. Entre com a nova senha.' });
}

function requireUserId(req: Request): string {
  if (!req.userId) {
    throw new AppError('Não autenticado', 401);
  }
  return req.userId;
}

export async function me(req: Request, res: Response): Promise<void> {
  res.status(200).json(await getCurrentUser(requireUserId(req)));
}

export async function confirmTerms(req: Request, res: Response): Promise<void> {
  const input = acceptTermsSchema.parse(req.body);
  const user = await acceptTerms(requireUserId(req), input);
  await recordAccess(user.id, 'ACCEPT_TERMS', req.ip);
  res.status(200).json(user);
}
