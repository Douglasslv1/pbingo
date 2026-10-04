import { Request } from 'express';
import { AppError } from '../utils/errors';
import { verifyAuthToken } from './jwt';
import { prisma } from './prisma';

/**
 * Valida o token de login e devolve o id do usuario. Rejeita tokens expirados, de usuarios
 * removidos ou emitidos antes da ultima troca de senha. Usado pela API e pelo WebSocket.
 */
export async function authenticateToken(token: string): Promise<string> {
  let payload: { userId: string; iat?: number };
  try {
    payload = verifyAuthToken(token);
  } catch {
    throw new AppError('Token de autenticação inválido ou expirado', 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { passwordChangedAt: true },
  });
  if (!user) {
    throw new AppError('Token de autenticação inválido ou expirado', 401);
  }

  const changedAtSeconds = user.passwordChangedAt ? Math.floor(user.passwordChangedAt.getTime() / 1000) : null;
  if (changedAtSeconds !== null && (payload.iat ?? 0) < changedAtSeconds) {
    throw new AppError('Sua senha foi alterada. Entre novamente.', 401);
  }

  return payload.userId;
}

/** Rotas publicas: com login valido, devolve quem esta vendo; sem login (ou token invalido), null. */
export async function viewerOf(req: Request): Promise<string | null> {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  return token ? authenticateToken(token).catch(() => null) : null;
}
