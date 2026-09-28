import { NextFunction, Request, Response } from 'express';
import { verifyAuthToken } from '../lib/jwt';
import { AppError } from '../utils/errors';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError('Token de autenticacao ausente', 401);
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = verifyAuthToken(token);
    req.userId = payload.userId;
    next();
  } catch {
    throw new AppError('Token de autenticacao invalido ou expirado', 401);
  }
}
