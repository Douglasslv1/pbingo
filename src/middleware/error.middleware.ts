import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../lib/logger';
import { AppError } from '../utils/errors';

export function notFoundMiddleware(req: Request, res: Response): void {
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.path}` });
}

/** Status e corpo da resposta de erro (HTTP e pedidos pelo WebSocket); `context` vai para o log do erro nao tratado. */
export function errorResponse(err: unknown, context: Record<string, unknown>) {
  if (err instanceof AppError) return { status: err.statusCode, body: { error: err.message } };
  if (err instanceof ZodError) return { status: 422, body: { error: 'Dados inválidos', details: err.flatten() } };
  logger.error('Erro não tratado', { ...context, err });
  return { status: 500, body: { error: 'Erro interno do servidor' } };
}

export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction, // eslint-disable-line @typescript-eslint/no-unused-vars
): void {
  const { status, body } = errorResponse(err, { requestId: req.requestId, method: req.method, path: req.path });
  res.status(status).json(body);
}
