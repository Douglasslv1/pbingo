import { Request, Response } from 'express';
import { loginUser, registerUser } from './auth.service';
import { loginSchema, registerSchema } from './auth.types';

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
