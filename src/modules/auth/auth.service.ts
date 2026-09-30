import { prisma } from '../../lib/prisma';
import { comparePassword, hashPassword } from '../../lib/password';
import { signAuthToken } from '../../lib/jwt';
import { AppError } from '../../utils/errors';
import { AcceptTermsInput, LoginInput, RegisterInput } from './auth.types';
import { CURRENT_TERMS_VERSION, hasAcceptedCurrentTerms } from './terms';

type UserRecord = NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>;

/** Dados do usuario devolvidos ao app (sem senha nem dados sensiveis). */
function toPublicUser(user: UserRecord) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    termsAccepted: hasAcceptedCurrentTerms(user),
  };
}

export async function registerUser(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError('E-mail já cadastrado', 409);
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        birthDate: input.birthDate,
        termsAcceptedAt: new Date(),
        termsVersion: CURRENT_TERMS_VERSION,
      },
    });

    await tx.userCredit.create({ data: { userId: created.id, balance: 0 } });
    await tx.userPrize.create({ data: { userId: created.id, balanceFiat: 0 } });

    return created;
  });

  const token = signAuthToken({ userId: user.id });
  return { token, user: toPublicUser(user) };
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw new AppError('Credenciais invalidas', 401);
  }

  const validPassword = await comparePassword(input.password, user.passwordHash);
  if (!validPassword) {
    throw new AppError('Credenciais invalidas', 401);
  }

  const token = signAuthToken({ userId: user.id });
  return { token, user: toPublicUser(user) };
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError('Usuário não encontrado', 404);
  }
  return toPublicUser(user);
}

/** Contas criadas antes dos termos (ou de uma nova versao deles) aceitam aqui e informam a data de nascimento. */
export async function acceptTerms(userId: string, input: AcceptTermsInput) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { birthDate: input.birthDate, termsAcceptedAt: new Date(), termsVersion: CURRENT_TERMS_VERSION },
  });
  return toPublicUser(user);
}
