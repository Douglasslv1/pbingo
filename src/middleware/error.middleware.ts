import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';

export function notFoundMiddleware(req: Request, res: Response): void {
  res.status(404).json({ error: `Rota nao encontrada: ${req.method} ${req.path}` });
}

export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction, // eslint-disable-line @typescript-eslint/no-unused-vars
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({ error: 'Dados invalidos', details: err.flatten() });
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}
