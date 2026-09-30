import { NextFunction, Request, Response } from 'express';
import { authenticateToken } from '../lib/session';
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

  authenticateToken(header.slice('Bearer '.length))
    .then((userId) => {
      req.userId = userId;
      next();
    })
    .catch(next);
}
