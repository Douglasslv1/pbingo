import { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/errors';

/** Exige que o usuario autenticado seja ADMIN. O papel e lido do banco a cada requisicao para que a revogacao valha na hora. */
export async function adminMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = req.userId
    ? await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } })
    : null;

  if (user?.role !== 'ADMIN') {
    throw new AppError('Acesso restrito a administradores', 403);
  }
  next();
}
