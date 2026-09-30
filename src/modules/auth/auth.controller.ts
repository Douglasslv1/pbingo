import { Request, Response } from 'express';
import { loginUser, registerUser } from './auth.service';
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from './auth.types';
import { requestPasswordReset, resetPassword } from './passwordReset.service';

const FORGOT_PASSWORD_RESPONSE = {
  message: 'Se houver uma conta com este e-mail, enviaremos um link para redefinir a senha.',
};

export async function register(req: Request, res: Response): Promise<void> {
  const input = registerSchema.parse(req.body);
  const result = await registerUser(input);
  res.status(201).json(result);
}

export async function login(req: Request, res: Response): Promise<void> {
  const input = loginSchema.parse(req.body);
  const result = await loginUser(input);
  res.status(200).json(result);
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = forgotPasswordSchema.parse(req.body);
  // Sem await: a resposta (conteudo e tempo) nao pode revelar quais e-mails tem conta
  requestPasswordReset(email).catch((err) => {
    console.error('Erro ao enviar e-mail de redefinicao de senha', err);
  });
  res.status(200).json(FORGOT_PASSWORD_RESPONSE);
}

export async function confirmPasswordReset(req: Request, res: Response): Promise<void> {
  const { token, password } = resetPasswordSchema.parse(req.body);
  await resetPassword(token, password);
  res.status(200).json({ message: 'Senha redefinida. Entre com a nova senha.' });
}
