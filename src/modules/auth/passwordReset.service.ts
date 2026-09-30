import { createHash, randomBytes } from 'crypto';
import { env } from '../../config/env';
import { mailer } from '../../lib/mailer';
import { hashPassword } from '../../lib/password';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/errors';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function buildResetEmail(name: string, link: string, ttlMinutes: number) {
  return {
    subject: 'Redefinir sua senha do Pbingu',
    text: `Ola, ${name}!\n\nRecebemos um pedido para redefinir sua senha. Acesse o link abaixo (valido por ${ttlMinutes} minutos):\n\n${link}\n\nSe nao foi voce, ignore este e-mail - sua senha continua a mesma.`,
    html: `<p>Ola, ${escapeHtml(name)}!</p>
<p>Recebemos um pedido para redefinir sua senha. O link abaixo vale por ${ttlMinutes} minutos:</p>
<p><a href="${link}">Redefinir minha senha</a></p>
<p>Se nao foi voce, ignore este e-mail - sua senha continua a mesma.</p>`,
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/**
 * Gera um link de redefinicao e envia por e-mail. Nao revela se o e-mail existe:
 * quem chama sempre responde da mesma forma.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
  if (!user) {
    return;
  }

  const token = randomBytes(32).toString('hex');
  await prisma.$transaction([
    // Um novo pedido invalida os links anteriores ainda nao usados
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + env.passwordResetTtlMs),
      },
    }),
  ]);

  const link = `${env.frontendUrl}/redefinir-senha?token=${token}`;
  const ttlMinutes = Math.round(env.passwordResetTtlMs / 60_000);
  await mailer.send({ to: user.email, ...buildResetEmail(user.name, link, ttlMinutes) });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const passwordHash = await hashPassword(newPassword);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const resetToken = await tx.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!resetToken || resetToken.expiresAt <= now) {
      throw new AppError('Link de redefinicao invalido ou expirado', 400);
    }

    // Marca como usado so se ninguem usou antes (protege contra dois envios simultaneos)
    const consumed = await tx.passwordResetToken.updateMany({
      where: { id: resetToken.id, usedAt: null },
      data: { usedAt: now },
    });
    if (consumed.count === 0) {
      throw new AppError('Link de redefinicao invalido ou expirado', 400);
    }

    await tx.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash, passwordChangedAt: now },
    });
  });
}
