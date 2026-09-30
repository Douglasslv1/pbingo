import { NextFunction, Request, Response } from 'express';
import { AuthTokenPayload, verifyAuthToken } from '../lib/jwt';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/errors';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

function readToken(req: Request): AuthTokenPayload & { iat?: number } {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError('Token de autenticacao ausente', 401);
  }

  try {
    return verifyAuthToken(header.slice('Bearer '.length));
  } catch {
    throw new AppError('Token de autenticacao invalido ou expirado', 401);
  }
}

/** Rejeita tokens de usuarios removidos ou emitidos antes da ultima troca de senha. */
async function assertSessionStillValid(payload: AuthTokenPayload & { iat?: number }): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { passwordChangedAt: true },
  });
  if (!user) {
    throw new AppError('Token de autenticacao invalido ou expirado', 401);
  }

  const changedAtSeconds = user.passwordChangedAt ? Math.floor(user.passwordChangedAt.getTime() / 1000) : null;
  if (changedAtSeconds !== null && (payload.iat ?? 0) < changedAtSeconds) {
    throw new AppError('Sua senha foi alterada. Entre novamente.', 401);
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const payload = readToken(req);

  assertSessionStillValid(payload)
    .then(() => {
      req.userId = payload.userId;
      next();
    })
    .catch(next);
}
