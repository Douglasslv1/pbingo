import { prisma } from '../lib/prisma';

/**
 * Concede ou revoga o papel ADMIN de um usuario ja cadastrado.
 * Uso: node dist/scripts/set-admin.js <email> [--revoke]
 */
async function main(): Promise<void> {
  const [email, flag] = process.argv.slice(2);
  if (!email) {
    console.error('Uso: node dist/scripts/set-admin.js <email> [--revoke]');
    process.exitCode = 1;
    return;
  }

  const role = flag === '--revoke' ? 'PLAYER' : 'ADMIN';
  const result = await prisma.user.updateMany({ where: { email }, data: { role } });

  if (result.count === 0) {
    console.error(`Nenhum usuario encontrado com o e-mail ${email}`);
    process.exitCode = 1;
    return;
  }
  console.log(`${email} agora tem o papel ${role}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
