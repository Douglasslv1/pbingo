import { UserRole } from '@prisma/client';
import { prisma } from '../../lib/prisma';

/** Define o papel de um usuario ja cadastrado. Retorna false se o e-mail nao tiver conta. */
export async function setUserRole(email: string, role: UserRole): Promise<boolean> {
  const result = await prisma.user.updateMany({
    where: { email: { equals: email.trim(), mode: 'insensitive' } },
    data: { role },
  });
  return result.count > 0;
}
