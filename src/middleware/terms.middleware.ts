import { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { hasAcceptedCurrentTerms } from '../modules/auth/terms';
import { AppError } from '../utils/errors';

/** Exige maioridade informada e aceite da versao vigente dos termos antes de movimentar dinheiro ou jogar. */
export async function requireTermsAccepted(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = req.userId
    ? await prisma.user.findUnique({ where: { id: req.userId }, select: { termsVersion: true, birthDate: true } })
    : null;

  if (!user || !hasAcceptedCurrentTerms(user)) {
    throw new AppError('Aceite os Termos de Uso e a Política de Privacidade para continuar', 403);
  }
  next();
}
