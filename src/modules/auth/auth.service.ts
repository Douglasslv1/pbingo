import { prisma } from '../../lib/prisma';
import { comparePassword, hashPassword } from '../../lib/password';
import { signAuthToken } from '../../lib/jwt';
import { AppError } from '../../utils/errors';
import { LoginInput, RegisterInput } from './auth.types';

export async function registerUser(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError('E-mail ja cadastrado', 409);
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
      },
    });

    await tx.userCredit.create({ data: { userId: created.id, balance: 0 } });
    await tx.userPrize.create({ data: { userId: created.id, balanceFiat: 0 } });

    return created;
  });

  const token = signAuthToken({ userId: user.id });
  return { token, user: { id: user.id, name: user.name, email: user.email } };
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
  return { token, user: { id: user.id, name: user.name, email: user.email } };
}
